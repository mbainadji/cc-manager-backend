import 'dotenv/config'
import express from 'express'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import auth from './routes/auth.js'
import exams from './routes/exams.js'
import students from './routes/students.js'
import results from './routes/results.js'

const app = express()
app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_URL }))
app.use(express.json({ limit: '1mb' }))

app.get('/api/health', (_, res) => res.json({ ok: true }))
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 }), auth)
app.use('/api/exams', exams)
app.use('/api/students', students)
app.use('/api/results', results)

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ message: 'Erreur serveur' })
})

await mongoose.connect(process.env.MONGODB_URI)
app.listen(process.env.PORT || 4000, () => console.log('API prête'))