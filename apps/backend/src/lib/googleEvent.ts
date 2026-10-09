import type { AttendeeResponse } from '@prisma/client'

/**
 * Pure translation between a TerangaMeet scheduled meeting and a Google
 * Calendar event (Calendar API v3). Kept apart from the HTTP calls so the
 * shape Google receives is covered by tests.
 */
export interface MeetingForGoogle {
  id: string
  title: string
  description: string
  startsAt: Date
  endsAt: Date
  timezone: string
  url: string
  attendees: string[]
}

export function buildGoogleEvent(m: MeetingForGoogle) {
  return {
    summary: m.title,
    description: [m.description.trim(), `Rejoindre la réunion TerangaMeet : ${m.url}`].filter(Boolean).join('\n\n'),
    // No conferenceData: a third-party video link can only be attached by a
    // Calendar add-on. The location is where Calendar shows a clickable link.
    location: m.url,
    source: { title: 'TerangaMeet', url: m.url },
    start: { dateTime: m.startsAt.toISOString(), timeZone: m.timezone },
    end: { dateTime: m.endsAt.toISOString(), timeZone: m.timezone },
    attendees: m.attendees.map((email) => ({ email })),
    guestsCanModify: false,
    // Marks the event as ours: sync and edits only ever touch tagged events.
    extendedProperties: { private: { terangameetId: m.id } },
  }
}

const RESPONSES: Record<string, AttendeeResponse> = {
  accepted: 'ACCEPTED',
  declined: 'DECLINED',
  tentative: 'TENTATIVE',
  needsAction: 'NEEDS_ACTION',
}

export function responseFromGoogle(status: string | undefined): AttendeeResponse {
  return (status && RESPONSES[status]) || 'NEEDS_ACTION'
}

/**
 * Claims of an id_token. Its signature is not checked: the token comes
 * straight from Google's token endpoint over TLS, in exchange for our client
 * secret, which Google documents as sufficient. Never use this on a token
 * received from a browser.
 */
export function idTokenClaims(idToken: string): { email: string; emailVerified: boolean } {
  const payload = idToken.split('.')[1]
  if (!payload) throw new Error('Malformed id_token.')
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    email?: string
    email_verified?: boolean
  }
  if (!claims.email) throw new Error('id_token has no email.')
  return { email: claims.email.toLowerCase(), emailVerified: claims.email_verified === true }
}
