import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  role: { type: String, enum: ['student', 'professor'], required: true },
  fullName: { type: String, required: true, trim: true },
  matricule: { type: String, trim: true, unique: true, sparse: true },
  email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  group: { type: String, trim: true },
  // absent tant que l'étudiant n'a pas activé son compte
  passwordHash: { type: String, select: false },
  // hash du code d'activation remis à l'étudiant
  activationHash: { type: String, select: false },
  // hash du code de récupération, montré une seule fois à l'étudiant (l'enseignant ne le connaît pas)
  recoveryHash: { type: String, select: false },
}, { timestamps: true })

export default mongoose.model('User', userSchema)