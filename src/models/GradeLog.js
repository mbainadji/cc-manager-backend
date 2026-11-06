import mongoose from 'mongoose'

// Historique des modifications de notes : visible par le professeur de l'examen uniquement
const gradeLogSchema = new mongoose.Schema({
  exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  before: { type: mongoose.Schema.Types.Mixed, default: null },
  after: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: { createdAt: true, updatedAt: false } })

export default mongoose.model('GradeLog', gradeLogSchema)
