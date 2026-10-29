import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  role: { type: String, enum: ['student', 'professor'], required: true },
  fullName: { type: String, required: true, trim: true },
  matricule: { type: String, trim: true, unique: true, sparse: true },
  email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  // absent tant que l'étudiant n'a pas activé son compte
  passwordHash: { type: String, select: false },
}, { timestamps: true })

export default mongoose.model('User', userSchema)