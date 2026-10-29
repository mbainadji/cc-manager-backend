import { Router } from 'express'
import User from '../models/User.js'
import Exam from '../models/Exam.js'
import { requireAuth } from '../middleware/auth.js'

const r = Router()
r.use(requireAuth('professor'))

// Étudiants inscrits, avec les examens du professeur auxquels ils sont rattachés
r.get('/', async (req, res) => {
  const [list, exams] = await Promise.all([
    User.find({ role: 'student', passwordHash: { $exists: true } }).sort({ fullName: 1 }),
    Exam.find({ professor: req.user.id }).select('allStudents students'),
  ])
  res.json(list.map((s) => ({
    id: s._id,
    matricule: s.matricule,
    fullName: s.fullName,
    createdAt: s.createdAt,
    examIds: exams
      .filter((e) => e.allStudents || e.students.some((x) => String(x) === String(s._id)))
      .map((e) => String(e._id)),
  })))
})

export default r