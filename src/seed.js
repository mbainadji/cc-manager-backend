import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import User from './models/User.js'

await mongoose.connect(process.env.MONGODB_URI)

await User.deleteOne({ email: 'amadou.diallo@univ.test' })
await User.create({
  role: 'professor', fullName: 'Amadou Diallo', email: 'amadou.diallo@univ.test',
  passwordHash: await bcrypt.hash('motdepasse123', 10),
})

console.log('Professeur créé')
await mongoose.disconnect()