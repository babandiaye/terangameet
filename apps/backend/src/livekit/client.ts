import { RoomServiceClient, EgressClient, WebhookReceiver } from 'livekit-server-sdk'
import { env } from '../config/env'

/** Server-side LiveKit room management (mute/remove/update participants, metadata). */
export const roomService = new RoomServiceClient(
  env.livekit.apiUrl,
  env.livekit.apiKey,
  env.livekit.apiSecret
)

/** Egress client for recordings. */
export const egressClient = new EgressClient(
  env.livekit.apiUrl,
  env.livekit.apiKey,
  env.livekit.apiSecret
)

/** Verifies signed LiveKit webhook payloads. */
export const webhookReceiver = new WebhookReceiver(env.livekit.apiKey, env.livekit.apiSecret)
