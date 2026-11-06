import mongoose from 'mongoose'

const gradeSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  score: { type: Number, default: null },
  // absent à l'épreuve (score null) : différent d'une note pas encore saisie
  absent: { type: Boolean, default: false },
  comment: { type: String, default: '' },
  // renseigné quand une note est modifiée après la publication
  correctedAt: { type: Date, default: null },
}, { timestamps: true })

gradeSchema.index({ exam: 1, student: 1 }, { unique: true })

export default mongoose.model('Grade', gradeSchema)