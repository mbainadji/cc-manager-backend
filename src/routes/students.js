import { Router } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Exam from '../models/Exam.js'
import Grade from '../models/Grade.js'
import { requireAuth } from '../middleware/auth.js'

const r = Router()
r.use(requireAuth('professor'))

const MAX_ROWS = 2000
const key = (m) => String(m).trim().toLowerCase()
// Nom : insensible à la casse, aux accents et à l'ordre des mots
const normName = (s = '') =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().split(/\s+/).sort().join(' ')

const findStudent = (id) =>
  mongoose.isValidObjectId(id) ? User.findOne({ _id: id, role: 'student' }).select('+passwordHash') : null

// Tous les étudiants de la liste, inscrits ou non, avec leurs examens
r.get('/', async (req, res) => {
  const [list, exams] = await Promise.all([
    User.find({ role: 'student' }).select('+passwordHash').sort({ fullName: 1 }),
    Exam.find({ professor: req.user.id }).select('allStudents students'),
  ])
  res.json(list.map((s) => ({
    id: s._id,
    matricule: s.matricule,
    fullName: s.fullName,
    group: s.group ?? '',
    createdAt: s.createdAt,
    registered: !!s.passwordHash,
    examIds: exams
      .filter((e) => e.allStudents || e.students.some((x) => String(x) === String(s._id)))
      .map((e) => String(e._id)),
  })))
})

// Import : body = { students: [{ matricule, fullName }] }
// Nouveau matricule : ajouté. Matricule existant sans compte : nom mis à jour. Avec compte : inchangé.
r.post('/import', async (req, res) => {
  const raw = Array.isArray(req.body.students) ? req.body.students : []
  if (raw.length > MAX_ROWS) return res.status(400).json({ message: `Maximum ${MAX_ROWS} lignes par import` })

  const seen = new Set()
  const rows = []
  let ignored = 0
  for (const s of raw) {
    const matricule = String(s?.matricule ?? '').trim()
    const fullName = String(s?.fullName ?? '').trim().replace(/\s+/g, ' ')
    const group = String(s?.group ?? '').trim().replace(/\s+/g, ' ')
    if (!matricule || !fullName || matricule.length > 40 || fullName.length > 120 || group.length > 40 || seen.has(key(matricule))) {
      ignored++
      continue
    }
    seen.add(key(matricule))
    rows.push({ matricule, fullName, group })
  }
  if (!rows.length) return res.status(400).json({ message: 'Aucun étudiant valide dans la liste' })

  const existing = await User.find({ role: 'student', matricule: { $in: rows.map((x) => x.matricule) } })
    .collation({ locale: 'fr', strength: 2 })
    .select('+passwordHash')
  const byKey = new Map(existing.map((u) => [key(u.matricule), u]))

  const ops = []
  const conflicts = []
  let created = 0, updated = 0, skipped = 0
  for (const row of rows) {
    const u = byKey.get(key(row.matricule))
    if (!u) {
      // matricule inconnu : ajouté
      ops.push({ insertOne: { document: { role: 'student', ...row } } })
      created++
    } else if (normName(u.fullName) !== normName(row.fullName)) {
      // même matricule, nom différent : rien n'est modifié, l'enseignant corrige à la main
      conflicts.push(row.matricule)
    } else if (!u.group && row.group) {
      // déjà présent, groupe encore vide : on le complète
      ops.push({ updateOne: { filter: { _id: u._id }, update: { $set: { group: row.group } } } })
      updated++
    } else {
      skipped++
    }
  }
  if (ops.length) await User.bulkWrite(ops)
  res.status(201).json({ created, updated, skipped, ignored, conflicts: conflicts.length, conflictMatricules: conflicts.slice(0, 10) })
})

// Suppression : seulement un étudiant sans compte (erreur d'import)
r.delete('/:id', async (req, res) => {
  const student = await findStudent(req.params.id)
  if (!student) return res.status(404).json({ message: 'Étudiant introuvable' })
  if (student.passwordHash)
    return res.status(409).json({ message: 'Un étudiant qui a créé son compte ne peut pas être supprimé' })
  await Grade.deleteMany({ student: student._id })
  await Exam.updateMany({ students: student._id }, { $pull: { students: student._id } })
  await student.deleteOne()
  res.status(204).end()
})

export default r