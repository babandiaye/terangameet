import { DataPacket_Kind } from 'livekit-server-sdk'
import { roomService } from './client'
import { logger } from '../lib/logger'

/** Broadcast a JSON notification to a room's participants via LiveKit data channel. */
export async function notifyRoom(
  room: string,
  payload: Record<string, unknown>,
  destinationIdentities?: string[]
): Promise<void> {
  try {
    const data = new TextEncoder().encode(JSON.stringify(payload))
    await roomService.sendData(room, data, DataPacket_Kind.RELIABLE, {
      ...(destinationIdentities ? { destinationIdentities } : {}),
    })
  } catch (err) {
    logger.warn(`[notify] sendData failed for room ${room}: ${(err as Error).message}`)
  }
}
