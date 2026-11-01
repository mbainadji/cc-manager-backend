import crypto from 'crypto'

// Alphabet sans caractères ambigus (pas de 0/O, 1/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const pick = () => Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('')
export const newCode = () => `${pick()}-${pick()}`

const clean = (c) => String(c ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

// Hash HMAC : le code n'est jamais stocké en clair (dépend de JWT_SECRET)
export const hashCode = (c) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(clean(c)).digest('hex')

export const codeMatches = (hash, c) => {
  if (!hash || !clean(c)) return false
  const a = Buffer.from(hash)
  const b = Buffer.from(hashCode(c))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
