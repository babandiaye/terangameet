import { proxy } from 'valtio'

export interface PresenceSession {
  /** epoch ms when the participant (re)joined */
  join: number
  /** epoch ms when they left, or null if still online */
  leave: number | null
}

export interface ParticipantStat {
  identity: string
  name: string
  isLocal: boolean
  /** accumulated active-speaking time, in ms */
  speakingMs: number
  messageCount: number
  handRaiseCount: number
  online: boolean
  firstSeen: number
  sessions: PresenceSession[]
}

interface AnalyticsState {
  /** epoch ms when tracking started (local participant joined) */
  startedAt: number | null
  /** ticked every second so derived views recompute live */
  now: number
  totalMessages: number
  totalHandRaises: number
  participants: Record<string, ParticipantStat>
  /** whether the dashboard modal is open */
  isOpen: boolean
}

export const analyticsStore = proxy<AnalyticsState>({
  startedAt: null,
  now: Date.now(),
  totalMessages: 0,
  totalHandRaises: 0,
  participants: {},
  isOpen: false,
})

/** Reset everything (call when leaving a room). */
export function resetAnalytics() {
  analyticsStore.startedAt = null
  analyticsStore.now = Date.now()
  analyticsStore.totalMessages = 0
  analyticsStore.totalHandRaises = 0
  analyticsStore.participants = {}
  analyticsStore.isOpen = false
}

export function ensureParticipant(
  identity: string,
  name: string,
  isLocal: boolean,
  now: number
): ParticipantStat {
  let p = analyticsStore.participants[identity]
  if (!p) {
    p = {
      identity,
      name,
      isLocal,
      speakingMs: 0,
      messageCount: 0,
      handRaiseCount: 0,
      online: true,
      firstSeen: now,
      sessions: [{ join: now, leave: null }],
    }
    analyticsStore.participants[identity] = p
  } else if (name && p.name !== name) {
    p.name = name
  }
  return p
}

export function markOnline(identity: string, name: string, isLocal: boolean, now: number) {
  const p = ensureParticipant(identity, name, isLocal, now)
  if (!p.online) {
    p.online = true
    p.sessions.push({ join: now, leave: null })
  }
}

export function markOffline(identity: string, now: number) {
  const p = analyticsStore.participants[identity]
  if (!p) return
  p.online = false
  const last = p.sessions[p.sessions.length - 1]
  if (last && last.leave === null) last.leave = now
}
