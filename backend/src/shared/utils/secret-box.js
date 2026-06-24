const crypto = require('crypto')

function getKey() {
  const source = process.env.INTEGRATION_ENCRYPTION_KEY || process.env.JWT_SECRET || 'aps-edu-integration-key'
  return crypto.createHash('sha256').update(source).digest()
}

function encrypt(value) {
  if (!value) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`
}

function decrypt(payload) {
  if (!payload) return null
  const [ivB64, tagB64, encryptedB64] = String(payload).split('.')
  if (!ivB64 || !tagB64 || !encryptedB64) return null
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedB64, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

module.exports = { encrypt, decrypt }
