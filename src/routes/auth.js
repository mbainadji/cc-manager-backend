import { Router } from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { sign, requireAuth } from '../middleware/auth.js'

const r = Router()
const safe = (u) => ({ id: u._id, role: u.role, name: u.fullName, matricule: u.matricule, email: u.email })

// Nom : insensible à la casse, aux accents et à l'ordre ("Koné Aïcha" = "aicha kone")
const norm = (s = '') =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().split(/\s+/).sort().join(' ')

// Matricule : format libre, seule la casse est ignorée
const byMatricule = (matricule) =>
  User.findOne({ role: 'student', matricule: String(matricule ?? '').trim() })
    .collation({ locale: 'fr', strength: 2 })
    .select('+passwordHash')

// Inscription : crée le compte, l'étudiant entre aussitôt dans la liste du professeur
r.post('/student/register', async (req, res) => {
  const { fullName, matricule, password } = req.body
  if (!fullName?.trim() || !matricule?.trim() || !password || password.length < 8)
    return res.status(400).json({ message: 'Nom, matricule et mot de passe (8 caractères min.) requis' })

  if (await byMatricule(matricule))
    return res.status(409).json({ message: 'Ce matricule est déjà inscrit' })

  const user = await User.create({
    role: 'student',
    fullName: fullName.trim().replace(/\s+/g, ' '),
    matricule: matricule.trim(),
    passwordHash: await bcrypt.hash(password, 10),
  })
  res.status(201).json({ token: sign(user), user: safe(user) })
})

// Connexion : nom + matricule + mot de passe, les trois doivent être corrects
r.post('/student/login', async (req, res) => {
  const { fullName, matricule, password } = req.body
  const user = await byMatricule(matricule)
  const ok = user
    && norm(user.fullName) === norm(fullName)
    && user.passwordHash
    && await bcrypt.compare(password || '', user.passwordHash)
  if (!ok) return res.status(401).json({ message: 'Nom, matricule ou mot de passe incorrect' })
  res.json({ token: sign(user), user: safe(user) })
})

r.post('/professor/login', async (req, res) => {
  const { email, password } = req.body
  const user = await User.findOne({ role: 'professor', email: email?.trim().toLowerCase() }).select('+passwordHash')
  if (!user || !(await bcrypt.compare(password || '', user.passwordHash)))
    return res.status(401).json({ message: 'Identifiants incorrects' })
  res.json({ token: sign(user), user: safe(user) })
})

r.get('/me', requireAuth(), async (req, res) => {
  const user = await User.findById(req.user.id)
  res.json({ user: safe(user) })
})

export default r
