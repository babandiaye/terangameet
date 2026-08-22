/** Human-readable duration from seconds, e.g. "1 h 04" or "12 min". */
export const formatDuration = (sec: number | null | undefined): string => {
  if (!sec || sec < 0) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')}`
  if (m > 0) return `${m} min`
  return `${s} s`
}

/** Short date-time in fr locale. */
export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Clock time HH:mm:ss in fr locale (for entry/exit within a meeting). */
export const formatClock = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** Label a time-bucket for the dashboard charts, per the selected range. */
export const formatBucket = (
  iso: string,
  range: 'h24' | 'd7' | 'd30' | 'm12'
): string => {
  const d = new Date(iso)
  if (range === 'h24')
    return d
      .toLocaleTimeString('fr-FR', { hour: '2-digit' })
      .replace(':00', 'h')
  if (range === 'd7') return d.toLocaleDateString('fr-FR', { weekday: 'short' })
  // Over 30 daily buckets weekday names would repeat four times, so date them.
  if (range === 'd30')
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  return d.toLocaleDateString('fr-FR', { month: 'short' })
}

/** Compact relative time, e.g. "il y a 5 min", "il y a 2 h". */
export const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `il y a ${h} h`
  const days = Math.round(h / 24)
  return `il y a ${days} j`
}
