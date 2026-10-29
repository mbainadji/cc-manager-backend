import jwt from 'jsonwebtoken'

export const sign = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' })

export const requireAuth = (role) => (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ message: 'Non authentifié' })
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ message: 'Session expirée' })
  }
  if (role && req.user.role !== role) return res.status(403).json({ message: 'Accès refusé' })
  next()
}
