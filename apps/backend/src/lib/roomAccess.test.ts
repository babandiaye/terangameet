import { describe, expect, it } from 'vitest'
import { entryDecision, parseEmailList } from './roomAccess'

describe('entryDecision', () => {
  it('lets anyone straight into a public room', () => {
    expect(entryDecision({ accessLevel: 'PUBLIC', isAuthenticated: false, role: null })).toBe('direct')
    expect(entryDecision({ accessLevel: 'PUBLIC', isAuthenticated: true, role: null })).toBe('direct')
  })

  it('sends guests of a trusted room to the waiting room, not signed-in users', () => {
    expect(entryDecision({ accessLevel: 'TRUSTED', isAuthenticated: false, role: null })).toBe('lobby')
    expect(entryDecision({ accessLevel: 'TRUSTED', isAuthenticated: true, role: null })).toBe('direct')
  })

  it('makes everyone without a standing wait in a restricted room', () => {
    expect(entryDecision({ accessLevel: 'RESTRICTED', isAuthenticated: false, role: null })).toBe('lobby')
    expect(entryDecision({ accessLevel: 'RESTRICTED', isAuthenticated: true, role: null })).toBe('lobby')
  })

  it('lets listed participants and organizers into a restricted room', () => {
    for (const role of ['MEMBER', 'ADMIN', 'OWNER'] as const) {
      expect(entryDecision({ accessLevel: 'RESTRICTED', isAuthenticated: true, role })).toBe('direct')
    }
  })
})

describe('parseEmailList', () => {
  it('splits on commas, semicolons, spaces and new lines', () => {
    const { valid, invalid } = parseEmailList('a@unchk.edu.sn, b@unchk.edu.sn;c@x.org\nd@y.com  e@z.fr')
    expect(valid).toEqual(['a@unchk.edu.sn', 'b@unchk.edu.sn', 'c@x.org', 'd@y.com', 'e@z.fr'])
    expect(invalid).toEqual([])
  })

  it('lowercases and de-duplicates, keeping first-seen order', () => {
    const { valid } = parseEmailList(['Moussa.Diop@UNCHK.edu.sn', 'awa@unchk.edu.sn', 'moussa.diop@unchk.edu.sn'])
    expect(valid).toEqual(['moussa.diop@unchk.edu.sn', 'awa@unchk.edu.sn'])
  })

  it('reports what is not an email address instead of silently dropping it', () => {
    const { valid, invalid } = parseEmailList('ok@unchk.edu.sn, pas-un-email, @x.org')
    expect(valid).toEqual(['ok@unchk.edu.sn'])
    expect(invalid).toEqual(['pas-un-email', '@x.org'])
  })

  it('accepts the "Name <address>" form pasted from a mail client', () => {
    const { valid } = parseEmailList('Awa Ndiaye <awa.ndiaye@unchk.edu.sn>')
    expect(valid).toEqual(['awa.ndiaye@unchk.edu.sn'])
  })
})
