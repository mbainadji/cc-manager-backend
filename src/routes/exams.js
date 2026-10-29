import { Router } from 'express'
import mongoose from 'mongoose'
import Exam from '../models/Exam.js'
import Grade from '../models/Grade.js'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'

const r = Router()
r.use(requireAuth('professor'))

const registered = { role: 'student', passwordHash: { $exists: true } }

// Examen appartenant au professeur connecté (null sinon)
const own = (req) =>
  mongoose.isValidObjectId(req.params.id)
    ? Exam.findOne({ _id: req.params.id, professor: req.user.id })
    : null

// Étudiants concernés : tous les inscrits, ou la sélection du professeur
const roster = (exam) =>
  User.find(exam.allStudents ? registered : { ...registered, _id: { $in: exam.students } }).sort({ fullName: 1 })

const view = (e, studentsCount, gradedCount = 0) => ({
  id: e._id, title: e.title, subject: e.subject, description: e.description,
  date: e.date, maxScore: e.maxScore, status: e.status, publishedAt: e.publishedAt,
  allStudents: e.allStudents, studentsCount, gradedCount,
})

const countGraded = (exam, ids) =>
  Grade.countDocuments({ exam: exam._id, student: { $in: ids }, score: { $ne: null } })

// brouillon -> saisie en cours -> prêt à publier, selon les notes saisies
const refresh = async (exam) => {
  const ids = (await roster(exam)).map((s) => s._id)
  const graded = await countGraded(exam, ids)
  if (exam.status !== 'published') {
    exam.status = graded === 0 ? 'draft' : graded >= ids.length ? 'ready' : 'grading'
    await exam.save()
  }
  return { total: ids.length, graded }
}

const pickStudents = async (ids) => {
  const clean = [...new Set((Array.isArray(ids) ? ids : []).filter(mongoose.isValidObjectId))]
  return (await User.find({ ...registered, _id: { $in: clean } }).select('_id')).map((s) => s._id)
}

r.get('/', async (req, res) => {
  const filter = { professor: req.user.id }
  if (req.query.status) filter.status = req.query.status
  const exams = await Exam.find(filter).sort({ date: -1 })
  const totalRegistered = await User.countDocuments(registered)
  const counts = await Grade.aggregate([
    { $match: { exam: { $in: exams.map((e) => e._id) }, score: { $ne: null } } },
    { $group: { _id: '$exam', n: { $sum: 1 } } },
  ])
  const byExam = new Map(counts.map((c) => [String(c._id), c.n]))
  res.json(exams.map((e) =>
    view(e, e.allStudents ? totalRegistered : e.students.length, byExam.get(String(e._id)) ?? 0)))
})

r.post('/', async (req, res) => {
  const { title, subject, date, maxScore, description, allStudents, students } = req.body
  const max = Number(maxScore ?? 20)
  if (!title?.trim() || !subject?.trim() || !date || Number.isNaN(new Date(date).getTime()))
    return res.status(400).json({ message: 'Titre, matière et date sont requis' })
  if (!(max >= 1)) return res.status(400).json({ message: 'Barème invalide' })

  const all = allStudents !== false
  const picked = all ? [] : await pickStudents(students)
  if (!all && picked.length === 0)
    return res.status(400).json({ message: 'Sélectionnez au moins un étudiant' })

  const exam = await Exam.create({
    title, subject, description, date, maxScore: max,
    allStudents: all, students: picked, professor: req.user.id,
  })
  const { total } = await refresh(exam)
  res.status(201).json(view(exam, total))
})

r.get('/:id', async (req, res) => {
  const exam = await own(req)
  if (!exam) return res.status(404).json({ message: 'Examen introuvable' })
  const ids = (await roster(exam)).map((s) => s._id)
  res.json(view(exam, ids.length, await countGraded(exam, ids)))
})

r.patch('/:id', async (req, res) => {
  const exam = await own(req)
  if (!exam) return res.status(404).json({ message: 'Examen introuvable' })
  if (exam.status === 'published') return res.status(409).json({ message: 'Examen déjà publié' })
  for (const k of ['title', 'subject', 'description', 'date', 'maxScore']) if (k in req.body) exam[k] = req.body[k]
  if ('allStudents' in req.body) exam.allStudents = req.body.allStudents !== false
  if ('students' in req.body) exam.students = await pickStudents(req.body.students)
  const { total, graded } = await refresh(exam)
  res.json(view(exam, total, graded))
})

r.delete('/:id', async (req, res) => {
  const exam = await own(req)
  if (!exam) return res.status(404).json({ message: 'Examen introuvable' })
  if (exam.status === 'published') return res.status(409).json({ message: 'Examen déjà publié' })
  await Grade.deleteMany({ exam: exam._id })
  await exam.deleteOne()
  res.status(204).end()
})

// Liste des étudiants concernés, avec leur note (pour l'écran de saisie)
r.get('/:id/grades', async (req, res) => {
  const exam = await own(req)
  if (!exam) return res.status(404).json({ message: 'Examen introuvable' })
  const students = await roster(exam)
  const grades = await Grade.find({ exam: exam._id, student: { $in: students.map((s) => s._id) } })
  const byStudent = new Map(grades.map((g) => [String(g.student), g]))
  res.json(students.map((s) => ({
    studentId: s._id, fullName: s.fullName, matricule: s.matricule,
    score: byStudent.get(String(s._id))?.score ?? null,
    comment: byStudent.get(String(s._id))?.comment ?? '',
  })))
})

// body : { grades: [{ studentId, score, comment }] }
r.put('/:id/grades', async (req, res) => {
  const exam = await own(req)
  if (!exam) return res.status(404).json({ message: 'Examen introuvable' })
  if (exam.status === 'published') return res.status(409).json({ message: 'Notes verrouillées' })
  const list = Array.isArray(req.body.grades) ? req.body.grades : []
  if (!list.length) return res.status(400).json({ message: 'Aucune note à enregistrer' })

  const enrolled = new Set((await roster(exam)).map((s) => String(s._id)))
  for (const g of list) {
    if (!enrolled.has(String(g.studentId)))
      return res.status(400).json({ message: 'Étudiant non concerné par cet examen' })
    if (g.score != null && (typeof g.score !== 'number' || g.score < 0 || g.score > exam.maxScore))
      return res.status(400).json({ message: `Note invalide (0 à ${exam.maxScore})` })
  }
  await Grade.bulkWrite(list.map((g) => ({
    updateOne: {
      filter: { exam: exam._id, student: g.studentId },
      update: { $set: { score: g.score ?? null, comment: g.comment ?? '' } },
      upsert: true,
    },
  })))
  const { total, graded } = await refresh(exam)
  res.json({ saved: list.length, status: exam.status, graded, total })
})

// Publication : au moins une note saisie ; les étudiants sans note ne voient rien
r.post('/:id/publish', async (req, res) => {
  const exam = await own(req)
  if (!exam) return res.status(404).json({ message: 'Examen introuvable' })
  if (exam.status === 'published') return res.status(409).json({ message: 'Examen déjà publié' })
  const { total, graded } = await refresh(exam)
  if (graded === 0) return res.status(409).json({ message: 'Saisissez au moins une note avant de publier' })
  exam.status = 'published'
  exam.publishedAt = new Date()
  await exam.save()
  res.json(view(exam, total, graded))
})

export default r