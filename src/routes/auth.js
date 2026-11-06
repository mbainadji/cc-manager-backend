import { Router } from 'express'
import bcrypt from 'bcryptjs'
import User from '../models/User.js'
import { sign, requireAuth } from '../middleware/auth.js'
import { codeMatches, newCode, hashCode } from '../utils/activation.js'

const r = Router()
const safe = (u) => ({ id: u._id, role: u.role, name: u.fullName, matricule: u.matricule, email: u.email, isAdmin: !!u.isAdmin })

// Nom : insensible à la casse, aux accents et à l'ordre ("Koné Aïcha" = "aicha kone")
const norm = (s = '') =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().split(/\s+/).sort().join(' ')

// Groupe : insensible à la casse, aux accents et aux espaces ("Groupe A" = "groupea")
const normGroup = (s = '') =>
  String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, '')

// Matricule : format libre, seule la casse est ignorée
const byMatricule = (matricule) =>
  User.findOne({ role: 'student', matricule: String(matricule ?? '').trim() })
    .collation({ locale: 'fr', strength: 2 })
    .select('+passwordHash +activationHash +recoveryHash')

// Inscription : réservée aux étudiants de la liste importée par le professeur
r.post('/student/register', async (req, res) => {
  const { fullName, matricule, group, code, password } = req.body
  if (!fullName?.trim() || !matricule?.trim() || !group?.trim() || !code?.trim() || !password || password.length < 8)
    return res.status(400).json({ message: 'Nom, matricule, groupe, code et mot de passe (8 caractères min.) requis' })

  const user = await byMatricule(matricule)
  // même message pour matricule inconnu et nom différent : on ne confirme pas quels matricules existent
  if (!user || norm(user.fullName) !== norm(fullName) || normGroup(user.group) !== normGroup(group) || !codeMatches(user.activationHash, code))
    return res.status(400).json({ message: 'Ces informations (nom, matricule, groupe, code) ne figurent pas dans la liste de votre établissement. Vérifiez-les ou contactez votre enseignant.' })
  if (user.passwordHash)
    return res.status(409).json({ message: 'Ce matricule a déjà un compte. Connectez-vous.' })

  // mise à jour atomique : si deux inscriptions arrivent en même temps, une seule passe
  const recovery = newCode() // code de récupération : montré une seule fois à l'étudiant
  const claimed = await User.findOneAndUpdate(
    { _id: user._id, passwordHash: { $exists: false } },
    { $set: { passwordHash: await bcrypt.hash(password, 10), recoveryHash: hashCode(recovery) }, $unset: { activationHash: '' } },
    { new: true },
  )
  if (!claimed) return res.status(409).json({ message: 'Ce matricule a déjà un compte. Connectez-vous.' })
  res.status(201).json({ token: sign(claimed), user: safe(claimed), recoveryCode: recovery })
})

// Mot de passe oublié : matricule + code de récupération personnel. L'enseignant n'intervient pas.
// Le code est à usage unique : un nouveau est renvoyé et doit être noté.
r.post('/student/reset', async (req, res) => {
  const { matricule, recoveryCode, password } = req.body
  if (!matricule?.trim() || !recoveryCode?.trim() || !password || password.length < 8)
    return res.status(400).json({ message: 'Matricule, code de récupération et nouveau mot de passe (8 caractères min.) requis' })

  const user = await byMatricule(matricule)
  if (!user || !user.passwordHash || !codeMatches(user.recoveryHash, recoveryCode))
    return res.status(400).json({ message: 'Matricule ou code de récupération incorrect' })

  const next = newCode()
  await User.updateOne({ _id: user._id }, {
    $set: { passwordHash: await bcrypt.hash(password, 10), recoveryHash: hashCode(next) },
  })
  res.json({ recoveryCode: next })
})

// Nouveau code de récupération pour un étudiant connecté (mot de passe demandé). L'ancien ne fonctionne plus.
r.post('/student/recovery', requireAuth('student'), async (req, res) => {
  const user = await User.findById(req.user.id).select('+passwordHash')
  if (!user?.passwordHash || !(await bcrypt.compare(String(req.body?.password ?? ''), user.passwordHash)))
    return res.status(400).json({ message: 'Mot de passe incorrect' })
  const next = newCode()
  await User.updateOne({ _id: user._id }, { $set: { recoveryHash: hashCode(next) } })
  res.json({ recoveryCode: next })
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

// Changement de mot de passe (étudiant ou professeur)
// 400 et non 401 : le 401 déconnecterait l'utilisateur côté front
r.patch('/password', requireAuth(), async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!newPassword || newPassword.length < 8)
    return res.status(400).json({ message: 'Le nouveau mot de passe doit faire 8 caractères minimum' })
  const user = await User.findById(req.user.id).select('+passwordHash')
  if (!user?.passwordHash || !(await bcrypt.compare(currentPassword || '', user.passwordHash)))
    return res.status(400).json({ message: 'Mot de passe actuel incorrect' })
  user.passwordHash = await bcrypt.hash(newPassword, 10)
  await user.save()
  res.json({ ok: true })
})

r.get('/me', requireAuth(), async (req, res) => {
  const user = await User.findById(req.user.id)
  res.json({ user: safe(user) })
})

export default r