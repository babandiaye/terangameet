import { describe, expect, it } from 'vitest'
import { buildIcs, escapeText, foldLine, icsDate } from './ics'

const base = {
  method: 'REQUEST' as const,
  uid: 'abc@terangameet.unchk.sn',
  sequence: 0,
  stamp: new Date('2026-10-09T10:00:00Z'),
  start: new Date('2026-10-15T09:00:00Z'),
  end: new Date('2026-10-15T10:30:00Z'),
  summary: 'Master LEPRAD',
  description: 'Séance 3',
  url: 'https://terangameet.unchk.sn/xrz-hnrt-nej',
  organizer: { email: 'papa@unchk.edu.sn', name: 'Papa NDIAYE' },
  attendees: [{ email: 'awa@unchk.edu.sn' }, { email: 'moussa@unchk.edu.sn', name: 'Moussa Diop' }],
}

describe('icsDate', () => {
  it('formats in UTC basic form', () => {
    expect(icsDate(new Date('2026-10-15T09:05:07.123Z'))).toBe('20261015T090507Z')
  })
})

describe('escapeText', () => {
  it('escapes backslash, semicolon, comma and new lines (RFC 5545 §3.3.11)', () => {
    expect(escapeText('a\\b;c,d\ne')).toBe('a\\\\b\\;c\\,d\\ne')
  })
})

describe('foldLine', () => {
  it('leaves short lines alone', () => {
    expect(foldLine('SUMMARY:court')).toBe('SUMMARY:court')
  })

  it('folds at 75 octets, continuation lines starting with a space', () => {
    const folded = foldLine('DESCRIPTION:' + 'x'.repeat(200))
    const lines = folded.split('\r\n')
    expect(lines.length).toBeGreaterThan(1)
    for (const l of lines) expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75)
    expect(lines.slice(1).every((l) => l.startsWith(' '))).toBe(true)
    expect(lines.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe('DESCRIPTION:' + 'x'.repeat(200))
  })

  it('never splits a multi-byte character', () => {
    const folded = foldLine('SUMMARY:' + 'é'.repeat(100))
    for (const l of folded.split('\r\n')) {
      expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75)
      expect(l).not.toContain('�')
    }
    expect(folded.split('\r\n').map((l, i) => (i ? l.slice(1) : l)).join('')).toBe('SUMMARY:' + 'é'.repeat(100))
  })
})

describe('buildIcs', () => {
  it('produces a REQUEST invitation calendars accept', () => {
    const ics = buildIcs(base)
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    for (const line of [
      'VERSION:2.0',
      'METHOD:REQUEST',
      'UID:abc@terangameet.unchk.sn',
      'SEQUENCE:0',
      'DTSTAMP:20261009T100000Z',
      'DTSTART:20261015T090000Z',
      'DTEND:20261015T103000Z',
      'SUMMARY:Master LEPRAD',
      'STATUS:CONFIRMED',
      'LOCATION:https://terangameet.unchk.sn/xrz-hnrt-nej',
      'URL:https://terangameet.unchk.sn/xrz-hnrt-nej',
      'ORGANIZER;CN=Papa NDIAYE:mailto:papa@unchk.edu.sn',
    ]) {
      expect(ics).toContain(`\r\n${line}\r\n`)
    }
    // Attendee lines exceed 75 octets: compare once unfolded.
    const unfolded = ics.replace(/\r\n /g, '')
    expect(unfolded).toContain('ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:awa@unchk.edu.sn')
    expect(unfolded).toContain('ATTENDEE;CN=Moussa Diop;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:moussa@unchk.edu.sn')
    // Every line ends with CRLF, none with a bare LF.
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('puts the link in the description so it is clickable in every client', () => {
    const unfolded = buildIcs(base).replace(/\r\n /g, '')
    expect(unfolded).toContain('DESCRIPTION:Séance 3\\n\\nRejoindre la réunion : https://terangameet.unchk.sn/xrz-hnrt-nej')
  })

  it('marks a cancellation as such', () => {
    const ics = buildIcs({ ...base, method: 'CANCEL', sequence: 2 })
    expect(ics).toContain('\r\nMETHOD:CANCEL\r\n')
    expect(ics).toContain('\r\nSTATUS:CANCELLED\r\n')
    expect(ics).toContain('\r\nSEQUENCE:2\r\n')
  })

  it('quotes a display name that contains reserved characters', () => {
    const ics = buildIcs({ ...base, organizer: { email: 'x@unchk.edu.sn', name: 'Diop, Awa; DITSI' } })
    expect(ics).toContain('ORGANIZER;CN="Diop, Awa; DITSI":mailto:x@unchk.edu.sn')
  })
})
