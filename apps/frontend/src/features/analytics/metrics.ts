import type { ParticipantStat } from './store'

export interface DashboardMetrics {
  durationMs: number
  participantsTotal: number
  participantsOnline: number
  totalMessages: number
  totalSpeakingMs: number
  totalHandRaises: number
  engagementScore: number // 0..100
  engagementLabel: 'low' | 'medium' | 'high'
  participationVocale: number // %
  repartitionEquitable: number // %
  chatInteractivite: number // %
  scoreGlobal: number // %
  participants: ParticipantStat[]
}

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n))

/** Gini coefficient (0 = perfectly equal, 1 = maximally unequal). */
function gini(values: number[]): number {
  const n = values.length
  if (n === 0) return 0
  const sum = values.reduce((a, b) => a + b, 0)
  if (sum === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  let cumulative = 0
  for (let i = 0; i < n; i++) cumulative += (2 * (i + 1) - n - 1) * sorted[i]
  return cumulative / (n * sum)
}

export interface MetricsInput {
  startedAt: number | null
  now: number
  totalMessages: number
  totalHandRaises: number
  participants: Record<string, ParticipantStat>
}

export function computeMetrics(s: MetricsInput): DashboardMetrics {
  const participants = Object.values(s.participants)
  const durationMs = s.startedAt ? Math.max(0, s.now - s.startedAt) : 0
  const online = participants.filter((p) => p.online)
  const totalSpeakingMs = participants.reduce((a, p) => a + p.speakingMs, 0)
  const speakers = participants.filter((p) => p.speakingMs > 0)

  // Sub-metrics
  const participationVocale = participants.length
    ? Math.round((speakers.length / participants.length) * 100)
    : 0

  const repartitionEquitable =
    speakers.length <= 1
      ? speakers.length === 0
        ? 0
        : 100
      : Math.round(100 * (1 - gini(speakers.map((p) => p.speakingMs))))

  const minutes = durationMs / 60000
  const messagesPerMinute = minutes > 0 ? s.totalMessages / minutes : 0
  const chatInteractivite = clamp(Math.round(messagesPerMinute * 25)) // 4 msg/min → 100%

  const denom = durationMs * Math.max(online.length, 1)
  const speakDensity = denom > 0 ? clamp((totalSpeakingMs / denom) * 100) : 0

  const scoreGlobal = clamp(
    Math.round(
      0.45 * speakDensity +
        0.3 * chatInteractivite +
        0.15 * participationVocale +
        0.1 * repartitionEquitable
    )
  )

  const engagementLabel = scoreGlobal >= 70 ? 'high' : scoreGlobal >= 40 ? 'medium' : 'low'

  return {
    durationMs,
    participantsTotal: participants.length,
    participantsOnline: online.length,
    totalMessages: s.totalMessages,
    totalSpeakingMs,
    totalHandRaises: s.totalHandRaises,
    engagementScore: scoreGlobal,
    engagementLabel,
    participationVocale,
    repartitionEquitable,
    chatInteractivite,
    scoreGlobal,
    participants: participants.sort((a, b) => b.speakingMs - a.speakingMs),
  }
}

/** Format ms as "Xm Ys" or "Ys". */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (m <= 0) return `${sec}s`
  return `${m}m ${sec.toString().padStart(2, '0')}s`
}

/** Format epoch ms as HH:MM:SS (local). */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('fr-FR', { hour12: false })
}
