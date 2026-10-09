import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Encryption at rest for OAuth refresh tokens: AES-256-GCM, a fresh 12-byte IV
 * per value, the authentication tag stored alongside. Format, all base64url:
 * `v1.<iv>.<tag>.<ciphertext>`. A tampered value or a wrong key throws rather
 * than yielding garbage.
 */
const VERSION = 'v1'

function keyBytes(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64')
  if (key.length !== 32) throw new Error('Token key must be 32 bytes (base64).')
  return key
}

export function encryptToken(plain: string, base64Key: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBytes(base64Key), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return [VERSION, iv, cipher.getAuthTag(), data].map((p) => (typeof p === 'string' ? p : p.toString('base64url'))).join('.')
}

export function decryptToken(sealed: string, base64Key: string): string {
  const [version, iv, tag, data] = sealed.split('.')
  if (version !== VERSION || !iv || !tag || !data) throw new Error('Unknown token format.')
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(base64Key), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
}
