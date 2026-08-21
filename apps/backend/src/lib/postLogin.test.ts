import { describe, expect, it } from 'vitest'
import { postLoginTarget, safeReturnTo } from './postLogin'

const BASE = 'https://meet.example.com'

describe('safeReturnTo', () => {
  it('keeps a same-origin absolute URL', () => {
    expect(safeReturnTo(`${BASE}/abc-defg-hij`, BASE)).toBe(`${BASE}/abc-defg-hij`)
  })

  it('resolves a relative path against the base', () => {
    expect(safeReturnTo('/mon-espace', BASE)).toBe(`${BASE}/mon-espace`)
  })

  it('rejects another origin (open redirect)', () => {
    expect(safeReturnTo('https://evil.example/phish', BASE)).toBe(BASE)
  })

  it('rejects a scheme change on the same host', () => {
    expect(safeReturnTo('http://meet.example.com/', BASE)).toBe(BASE)
  })

  it('falls back to the base on unparseable input', () => {
    expect(safeReturnTo('http://[', BASE)).toBe(BASE)
  })
})

describe('postLoginTarget', () => {
  it('sends a regular user from the landing page to their space', () => {
    expect(postLoginTarget(`${BASE}/`, BASE, false)).toBe(`${BASE}/mon-espace`)
  })

  it('sends an admin from the landing page to the console', () => {
    expect(postLoginTarget(`${BASE}/`, BASE, true)).toBe(`${BASE}/admin`)
  })

  it('preserves a deep link to a room', () => {
    expect(postLoginTarget(`${BASE}/abc-defg-hij`, BASE, false)).toBe(`${BASE}/abc-defg-hij`)
  })

  it('preserves a deep link to a recording, even for an admin', () => {
    const url = `${BASE}/recording/2f1c8e14-0000-4000-8000-000000000000`
    expect(postLoginTarget(url, BASE, true)).toBe(url)
  })

  it('preserves the query string of a deep link', () => {
    expect(postLoginTarget(`${BASE}/abc-defg-hij?x=1`, BASE, false)).toBe(
      `${BASE}/abc-defg-hij?x=1`
    )
  })

  it('treats a foreign origin as the landing page rather than following it', () => {
    expect(postLoginTarget('https://evil.example/', BASE, false)).toBe(`${BASE}/mon-espace`)
  })
})
