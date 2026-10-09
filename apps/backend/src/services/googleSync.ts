import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { env } from '../config/env'
import { responseFromGoogle } from '../lib/googleEvent'
import { googleEvents, GoogleConsentLost, isGoogleSyncEnabled } from './google'

/**
 * Bring the guests' answers (yes / no / maybe) back from Google Calendar for
 * meetings that live there. Reads only the events TerangaMeet created — by
 * their stored id, checked against our private tag — never the calendars.
 *
 * An event deleted by hand in Google Calendar is marked cancelled here too.
 */
export async function syncGoogleResponses(): Promise<void> {
  if (!(await isGoogleSyncEnabled())) return
  const now = Date.now()
  const meetings = await prisma.scheduledMeeting.findMany({
    where: {
      status: 'SCHEDULED',
      googleEventId: { not: null },
      endsAt: { gte: new Date(now - 3600 * 1000) },
      startsAt: { lte: new Date(now + 60 * 24 * 3600 * 1000) },
    },
    select: { id: true, organizerId: true, googleEventId: true },
    take: 500,
  })

  let updated = 0
  for (const m of meetings) {
    try {
      const event = await googleEvents.get(m.organizerId, m.googleEventId!)
      if (!event || event.extendedProperties?.private?.terangameetId !== m.id) continue
      if (event.status === 'cancelled') {
        await prisma.scheduledMeeting.update({ where: { id: m.id }, data: { status: 'CANCELLED' } })
        continue
      }
      for (const a of event.attendees ?? []) {
        if (!a.email) continue
        const { count } = await prisma.meetingAttendee.updateMany({
          where: { meetingId: m.id, email: a.email.toLowerCase() },
          data: { response: responseFromGoogle(a.responseStatus) },
        })
        updated += count
      }
    } catch (err) {
      // A revoked consent is the organiser's business (they are asked to
      // reconnect); anything else is worth a line in the logs.
      if (!(err instanceof GoogleConsentLost)) {
        logger.warn(`[google-sync] ${m.id}: ${(err as Error).message}`)
      }
    }
  }
  if (meetings.length) logger.debug(`[google-sync] ${meetings.length} meeting(s), ${updated} answer(s) refreshed`)
}

let running = false

/** Every 10 minutes while the credentials exist; a no-op cleanup otherwise. */
export function startGoogleSyncScheduler(): () => void {
  if (!env.google.configured) return () => {}
  const tick = async () => {
    if (running) return
    running = true
    try {
      await syncGoogleResponses()
    } catch (err) {
      logger.error('[google-sync] run failed', err)
    } finally {
      running = false
    }
  }
  const timer = setInterval(tick, 10 * 60 * 1000)
  return () => clearInterval(timer)
}
