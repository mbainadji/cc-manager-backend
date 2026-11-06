import { Router } from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'

const r = Router()
r.use(requireAuth('professor'))
// L'administrateur est lu en base, jamais dans le jeton
r.use(async (req, res, next) => {
  const me = await User.findById(req.user.id).select('isAdmin')
  if (!me?.isAdmin) return res.status(403).json({ message: "Réservé à l'administrateur" })
  next()
})

const tempPassword = () => crypto.randomBytes(9).toString('base64url') // 12 caractères
const view = (u) => ({ id: u._id, name: u.fullName, email: u.email, isAdmin: !!u.isAdmin })

r.get('/', async (_req, res) => {
  res.json((await User.find({ role: 'professor' }).sort({ fullName: 1 })).map(view))
})

// Création : le mot de passe provisoire n'est renvoyé qu'une fois
r.post('/', async (req, res) => {
  const fullName = String(req.body?.fullName ?? '').trim().replace(/\s+/g, ' ')
  const email = String(req.body?.email ?? '').trim().toLowerCase()
  if (!fullName || fullName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ message: 'Nom et e-mail valides requis' })
  const password = tempPassword()
  try {
    const u = await User.create({ role: 'professor', fullName, email, passwordHash: await bcrypt.hash(password, 10) })
    res.status(201).json({ ...view(u), password })
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Cet e-mail est déjà utilisé' })
    throw err
  }
})

// Réinitialisation : professeurs uniquement, jamais les étudiants
r.post('/:id/reset-password', async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Professeur introuvable' })
  const u = await User.findOne({ _id: req.params.id, role: 'professor' })
  if (!u) return res.status(404).json({ message: 'Professeur introuvable' })
  const password = tempPassword()
  await User.updateOne({ _id: u._id }, { $set: { passwordHash: await bcrypt.hash(password, 10) } })
  res.json({ password })
})

export default r
