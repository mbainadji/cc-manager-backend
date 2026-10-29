import mongoose from 'mongoose'

const examSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subject: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  date: { type: Date, required: true },
  maxScore: { type: Number, default: 20, min: 1 },
  status: { type: String, enum: ['draft', 'grading', 'ready', 'published'], default: 'draft' },
  publishedAt: { type: Date, default: null },
  // true : tous les étudiants inscrits ; false : seulement ceux de "students"
  allStudents: { type: Boolean, default: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  professor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })

export default mongoose.model('Exam', examSchema)