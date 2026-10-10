import { describe, expect, it } from 'vitest'
import type { Role, RoomAccessLevel } from '@prisma/client'
import { entryDecision, parseEmailList } from './roomAccess'

describe('entryDecision', () => {
  const decide = (accessLevel: RoomAccessLevel, isAuthenticated: boolean, role: Role | null = null) =>
    entryDecision({ accessLevel, isAuthenticated, role })

  it('lets anyone straight into a public room', () => {
    expect(decide('PUBLIC', false)).toBe('direct')
    expect(decide('PUBLIC', true)).toBe('direct')
  })

  it('makes everyone wait in a public room with a lobby, signed in or not', () => {
    expect(decide('PUBLIC_LOBBY', false)).toBe('lobby')
    expect(decide('PUBLIC_LOBBY', true)).toBe('lobby')
    expect(decide('PUBLIC_LOBBY', true, 'MEMBER')).toBe('lobby')
  })

  it('asks guests of a trusted room to sign in, and lets signed-in people in', () => {
    expect(decide('TRUSTED', false)).toBe('login')
    expect(decide('TRUSTED', true)).toBe('direct')
  })

  it('asks guests of a restricted room to sign in first', () => {
    expect(decide('RESTRICTED', false)).toBe('login')
  })

  it('makes signed-in people who are not listed wait in a restricted room', () => {
    expect(decide('RESTRICTED', true)).toBe('lobby')
  })

  it('lets listed participants into a restricted room', () => {
    expect(decide('RESTRICTED', true, 'MEMBER')).toBe('direct')
  })

  it('always lets the organizer and co-organizers in', () => {
    for (const level of ['PUBLIC', 'PUBLIC_LOBBY', 'TRUSTED', 'RESTRICTED'] as const) {
      for (const role of ['ADMIN', 'OWNER'] as const) {
        expect(decide(level, true, role)).toBe('direct')
      }
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
