import { Router } from 'express'
import mongoose from 'mongoose'
import Grade from '../models/Grade.js'
import { requireAuth } from '../middleware/auth.js'

const r = Router()
r.use(requireAuth('student'))

// Le filtre student vient du token, jamais du client ; seuls les examens publiés passent
const mine = async (studentId, extra = {}) => {
  const grades = await Grade.find({ student: studentId, ...extra }).populate({
    path: 'exam',
    match: { status: 'published' },
    select: 'title subject date maxScore publishedAt professor',
    populate: { path: 'professor', select: 'fullName' },
  })
  return grades.filter((g) => g.exam && g.score !== null)
}

const view = (g) => ({
  id: g._id,
  title: g.exam.title,
  subject: g.exam.subject,
  date: g.exam.date,
  publishedAt: g.exam.publishedAt,
  score: g.score,
  max: g.exam.maxScore,
  teacher: g.exam.professor ? `Pr. ${g.exam.professor.fullName}` : '',
  comment: g.comment,
})

r.get('/', async (req, res) => {
  const list = await mine(req.user.id)
  list.sort((a, b) => b.exam.publishedAt - a.exam.publishedAt)
  res.json(list.map(view))
})

r.get('/:id', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Résultat introuvable' })
  const [g] = await mine(req.user.id, { _id: req.params.id })
  if (!g) return res.status(404).json({ message: 'Résultat introuvable' })
  res.json(view(g))
})

export default r