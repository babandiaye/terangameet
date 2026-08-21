import { useEffect, useRef } from 'react'
import { useRoomContext, useChat } from '@livekit/components-react'
import { RoomEvent, type Participant } from 'livekit-client'
import {
  analyticsStore,
  ensureParticipant,
  markOnline,
  markOffline,
  resetAnalytics,
} from './store'

const labelOf = (p: Participant) => p.name || p.identity

/**
 * Continuously accumulates meeting analytics from LiveKit room events.
 * Mount once at the room level (e.g. in VideoConference) so data is complete
 * regardless of whether the dashboard modal is open.
 *
 * Speaking time is measured per participant with an event-driven approach: the
 * server-computed `ActiveSpeakersChanged` event tells us exactly who is speaking
 * at any moment (for every participant, even unsubscribed ones). We record the
 * instant each participant starts speaking and add the elapsed interval when they
 * stop — flushing partial time every second so the live view keeps incrementing.
 */
export function useAnalyticsTracker() {
  const room = useRoomContext()
  const { chatMessages } = useChat()

  // identity -> epoch ms when the current speaking burst started
  const speakingSince = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    const startNow = Date.now()
    if (analyticsStore.startedAt == null) analyticsStore.startedAt = startNow
    const since = speakingSince.current

    // Seed currently-present participants.
    ensureParticipant(room.localParticipant.identity, labelOf(room.localParticipant), true, startNow)
    room.remoteParticipants.forEach((p) =>
      ensureParticipant(p.identity, labelOf(p), false, startNow)
    )

    /** Add elapsed speaking time for one identity and re-anchor its start marker. */
    const flush = (identity: string, now: number) => {
      const start = since.get(identity)
      if (start == null) return
      const stat = analyticsStore.participants[identity]
      if (stat) stat.speakingMs += Math.max(0, now - start)
      since.set(identity, now)
    }

    // Exact start/stop detection from the server-side active-speaker set.
    const onActiveSpeakers = (speakers: Participant[]) => {
      const now = Date.now()
      const active = new Set(speakers.map((s) => s.identity))

      // Started speaking → anchor the start instant.
      speakers.forEach((s) => {
        ensureParticipant(s.identity, labelOf(s), s.isLocal, now)
        if (!since.has(s.identity)) since.set(s.identity, now)
      })

      // Stopped speaking → accumulate the burst and drop the marker.
      for (const identity of [...since.keys()]) {
        if (!active.has(identity)) {
          flush(identity, now)
          since.delete(identity)
        }
      }
    }

    // Every second: advance the clock and flush partial time for ongoing speech,
    // so the dashboard updates live without waiting for the speaker to stop.
    const interval = setInterval(() => {
      const now = Date.now()
      analyticsStore.now = now
      since.forEach((_start, identity) => flush(identity, now))
    }, 1000)

    const onConnected = (p: Participant) => markOnline(p.identity, labelOf(p), false, Date.now())
    const onDisconnected = (p: Participant) => {
      const now = Date.now()
      if (since.has(p.identity)) {
        flush(p.identity, now)
        since.delete(p.identity)
      }
      markOffline(p.identity, now)
    }

    // Count a hand raise each time handRaisedAt transitions to a non-empty value.
    const onAttrs = (changed: Record<string, string>, p: Participant) => {
      if ('handRaisedAt' in changed) {
        ensureParticipant(p.identity, labelOf(p), p.isLocal, Date.now())
        const stat = analyticsStore.participants[p.identity]
        if (changed.handRaisedAt) {
          if (stat) stat.handRaiseCount += 1
          analyticsStore.totalHandRaises += 1
        }
      }
    }

    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers)
    room.on(RoomEvent.ParticipantConnected, onConnected)
    room.on(RoomEvent.ParticipantDisconnected, onDisconnected)
    room.on(RoomEvent.ParticipantAttributesChanged, onAttrs)

    return () => {
      clearInterval(interval)
      room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers)
      room.off(RoomEvent.ParticipantConnected, onConnected)
      room.off(RoomEvent.ParticipantDisconnected, onDisconnected)
      room.off(RoomEvent.ParticipantAttributesChanged, onAttrs)
      since.clear()
    }
  }, [room])

  // Reset when the room instance changes / unmounts (leaving the meeting).
  useEffect(() => {
    return () => resetAnalytics()
  }, [room])

  // Keep message totals and per-participant counts in sync with the chat.
  useEffect(() => {
    analyticsStore.totalMessages = chatMessages.length
    const counts: Record<string, number> = {}
    chatMessages.forEach((m) => {
      const id = m.from?.identity
      if (id) counts[id] = (counts[id] ?? 0) + 1
    })
    Object.entries(counts).forEach(([id, count]) => {
      const stat = analyticsStore.participants[id]
      if (stat) stat.messageCount = count
    })
  }, [chatMessages])
}
