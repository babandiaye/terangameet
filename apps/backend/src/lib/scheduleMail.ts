/**
 * Body of a scheduled-meeting email. The calendar part (.ics) is what calendars
 * act on; this text is what a person reads, and what remains useful in a mail
 * client that ignores invitations.
 */
export type ScheduleMailKind = 'new' | 'update' | 'cancel'

export interface ScheduleMailContent {
  kind: ScheduleMailKind
  organizer: string
  title: string
  description?: string
  start: Date
  end: Date
  timezone: string
  url: string
}

/** Readable names for the zones in use; others fall back to the Intl offset. */
const ZONE_LABELS: Record<string, string> = { 'Africa/Dakar': 'heure de Dakar' }

/** « jeudi 15 octobre 2026, 09:00 – 10:30 (heure de Dakar) » in the meeting's zone. */
export function formatSlot(start: Date, end: Date, timezone: string): string {
  const day = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  }).format(start)
  const time = (d: Date) =>
    new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: timezone }).format(d)
  const zone =
    ZONE_LABELS[timezone] ??
    new Intl.DateTimeFormat('fr-FR', { timeZone: timezone, timeZoneName: 'short' })
      .formatToParts(start)
      .find((p) => p.type === 'timeZoneName')?.value ?? timezone
  return `${day}, ${time(start)} – ${time(end)} (${zone})`
}

export function scheduleSubject(c: ScheduleMailContent): string {
  if (c.kind === 'cancel') return `Annulée : ${c.title}`
  if (c.kind === 'update') return `Modifiée : ${c.title}`
  return `Invitation : ${c.title}`
}

function lead(c: ScheduleMailContent): string {
  if (c.kind === 'cancel') return `${c.organizer} a annulé la réunion « ${c.title} ».`
  if (c.kind === 'update') return `${c.organizer} a modifié la réunion « ${c.title} ».`
  return `${c.organizer} vous invite à la réunion « ${c.title} » sur TerangaMeet.`
}

export function scheduleText(c: ScheduleMailContent): string {
  return [
    'Bonjour,',
    '',
    lead(c),
    '',
    `Quand : ${formatSlot(c.start, c.end, c.timezone)}`,
    ...(c.kind === 'cancel' ? [] : [`Rejoindre : ${c.url}`]),
    ...(c.description ? ['', c.description] : []),
    '',
    '—',
    'TerangaMeet · UN-CHK',
  ].join('\n')
}

export function scheduleHtml(c: ScheduleMailContent): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const join =
    c.kind === 'cancel'
      ? ''
      : `<p style="margin:1.5rem 0">
        <a href="${esc(c.url)}" style="display:inline-block;background:#000091;color:#ffffff;text-decoration:none;padding:0.75rem 1.5rem;border-radius:10px;font-weight:600">Rejoindre la réunion</a>
      </p>
      <p style="margin:0 0 0.5rem;color:#666666;font-size:0.85rem">Ou copiez ce lien : <a href="${esc(c.url)}" style="color:#000091">${esc(c.url)}</a></p>`
  const description = c.description
    ? `<p style="margin:0 0 1rem;color:#3a3a3a;white-space:pre-wrap">${esc(c.description)}</p>`
    : ''
  return `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:2rem 1rem">
    <div style="background:#ffffff;border-radius:16px;padding:2rem;border:1px solid #e5e5e5">
      <h1 style="margin:0 0 1rem;font-size:1.25rem;color:#161616">${esc(c.title)}</h1>
      <p style="margin:0 0 1rem;color:#3a3a3a">${esc(lead(c))}</p>
      <p style="margin:0 0 1rem;color:#161616"><strong>${esc(formatSlot(c.start, c.end, c.timezone))}</strong></p>
      ${description}
      ${join}
    </div>
    <p style="text-align:center;color:#666666;font-size:0.8rem;margin-top:1.5rem">TerangaMeet · UN-CHK</p>
  </div>
</body></html>`
}
