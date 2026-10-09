import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { decryptToken, encryptToken } from './tokenCrypto'
import { buildGoogleEvent, idTokenClaims, responseFromGoogle } from './googleEvent'

const key = randomBytes(32).toString('base64')

describe('token encryption', () => {
  it('round-trips', () => {
    const sealed = encryptToken('1//refresh-token-value', key)
    expect(sealed).not.toContain('refresh-token-value')
    expect(decryptToken(sealed, key)).toBe('1//refresh-token-value')
  })

  it('uses a fresh IV each time', () => {
    expect(encryptToken('same', key)).not.toBe(encryptToken('same', key))
  })

  it('refuses a tampered value or the wrong key', () => {
    const sealed = encryptToken('secret', key)
    const [v, iv, tag, data] = sealed.split('.')
    const flipped = Buffer.from(data, 'base64url')
    flipped[0] ^= 1
    expect(() => decryptToken([v, iv, tag, flipped.toString('base64url')].join('.'), key)).toThrow()
    expect(() => decryptToken(sealed, randomBytes(32).toString('base64'))).toThrow()
  })
})

describe('buildGoogleEvent', () => {
  const event = buildGoogleEvent({
    id: 'm1',
    title: 'Master LEPRAD',
    description: 'Séance 3',
    startsAt: new Date('2026-10-15T09:00:00Z'),
    endsAt: new Date('2026-10-15T10:30:00Z'),
    timezone: 'Africa/Dakar',
    url: 'https://terangameet.unchk.sn/xrz-hnrt-nej',
    attendees: ['awa@unchk.edu.sn', 'moussa@unchk.edu.sn'],
  })

  it('carries the slot in the meeting time zone', () => {
    expect(event.start).toEqual({ dateTime: '2026-10-15T09:00:00.000Z', timeZone: 'Africa/Dakar' })
    expect(event.end).toEqual({ dateTime: '2026-10-15T10:30:00.000Z', timeZone: 'Africa/Dakar' })
  })

  it('puts the TerangaMeet link where people look for it', () => {
    expect(event.location).toBe('https://terangameet.unchk.sn/xrz-hnrt-nej')
    expect(event.description).toContain('Séance 3')
    expect(event.description).toContain('https://terangameet.unchk.sn/xrz-hnrt-nej')
    expect(event.source).toEqual({ title: 'TerangaMeet', url: 'https://terangameet.unchk.sn/xrz-hnrt-nej' })
  })

  it('tags the event so TerangaMeet only ever touches its own events', () => {
    expect(event.extendedProperties.private.terangameetId).toBe('m1')
  })

  it('lists the guests', () => {
    expect(event.attendees).toEqual([{ email: 'awa@unchk.edu.sn' }, { email: 'moussa@unchk.edu.sn' }])
  })
})

describe('responseFromGoogle', () => {
  it('maps Google statuses to ours', () => {
    expect(responseFromGoogle('accepted')).toBe('ACCEPTED')
    expect(responseFromGoogle('declined')).toBe('DECLINED')
    expect(responseFromGoogle('tentative')).toBe('TENTATIVE')
    expect(responseFromGoogle('needsAction')).toBe('NEEDS_ACTION')
    expect(responseFromGoogle(undefined)).toBe('NEEDS_ACTION')
  })
})

describe('idTokenClaims', () => {
  it('reads the email from an id_token received from the token endpoint', () => {
    const payload = Buffer.from(JSON.stringify({ email: 'Papa@UNCHK.edu.sn', email_verified: true })).toString(
      'base64url'
    )
    expect(idTokenClaims(`h.${payload}.s`)).toEqual({ email: 'papa@unchk.edu.sn', emailVerified: true })
  })

  it('rejects a malformed token', () => {
    expect(() => idTokenClaims('nope')).toThrow()
  })
})
