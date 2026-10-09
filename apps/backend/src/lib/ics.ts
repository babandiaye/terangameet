/**
 * iCalendar (RFC 5545) invitations, the format Gmail, Google Calendar and
 * Outlook read from an email to show Yes / No / Maybe and add the event.
 *
 * Pure on purpose: a malformed file is silently ignored by mail clients — no
 * error anywhere — so every rule that matters is covered by ics.test.ts.
 */

export interface IcsPerson {
  email: string
  name?: string | null
}

export interface IcsEvent {
  /** REQUEST: create or update the event; CANCEL: remove it. */
  method: 'REQUEST' | 'CANCEL'
  /** Stable across updates: calendars match an update to its event by UID. */
  uid: string
  /** Bumped on every change, so calendars apply updates in order. */
  sequence: number
  stamp: Date
  start: Date
  end: Date
  summary: string
  description?: string
  /** The meeting link: shown as location and appended to the description. */
  url: string
  organizer: IcsPerson
  attendees: IcsPerson[]
}

/** UTC date-time in the basic form, e.g. 20261015T090000Z. */
export function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** TEXT value escaping (§3.3.11): backslash, semicolon, comma, new line. */
export function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Fold a content line at 75 octets (§3.1): continuation lines start with one
 * space. Counted in UTF-8 bytes and cut between characters, never inside one
 * — a split "é" would corrupt the line for strict parsers.
 */
export function foldLine(line: string): string {
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = Buffer.byteLength(ch, 'utf8')
    // The first line holds 75 octets; continuations 74 after their leading space.
    const limit = parts.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  parts.push(current)
  return parts.map((p, i) => (i === 0 ? p : ` ${p}`)).join('\r\n')
}

/** CN parameter: quoted when it holds characters that end a parameter. */
function cn(name: string | null | undefined): string {
  if (!name) return ''
  const clean = name.replace(/"/g, "'").replace(/[\r\n]+/g, ' ').trim()
  if (!clean) return ''
  return /[;:,]/.test(clean) ? `;CN="${clean}"` : `;CN=${clean}`
}

export function buildIcs(event: IcsEvent): string {
  const description = [event.description?.trim(), `Rejoindre la réunion : ${event.url}`]
    .filter(Boolean)
    .join('\n\n')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//UN-CHK//TerangaMeet//FR',
    'CALSCALE:GREGORIAN',
    `METHOD:${event.method}`,
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `SEQUENCE:${event.sequence}`,
    `DTSTAMP:${icsDate(event.stamp)}`,
    `DTSTART:${icsDate(event.start)}`,
    `DTEND:${icsDate(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `LOCATION:${escapeText(event.url)}`,
    `URL:${event.url}`,
    `STATUS:${event.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
    `ORGANIZER${cn(event.organizer.name)}:mailto:${event.organizer.email}`,
    ...event.attendees.map(
      (a) =>
        `ATTENDEE${cn(a.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${a.email}`
    ),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(foldLine).join('\r\n') + '\r\n'
}
