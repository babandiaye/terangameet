import type { User } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { roomService } from '../livekit/client'

/**
 * Keep a deactivated account out of meetings. LiveKit cannot revoke a token,
 * and the one in the person's hands stays valid for up to 6 hours, so the door
 * is closed twice:
 *  - when an administrator deactivates the account, the person is removed
 *    from every meeting in progress (ejectFromAllRooms);
 *  - whenever LiveKit reports someone joining, a deactivated account is
 *    removed at once (ejectIfDeactivated, from the webhook) — which covers a
 *    reconnection with the old token.
 *
 * A signed-in participant's LiveKit identity is their OIDC `sub`, or their
 * user id (routes/rooms.ts); guests are `anon-…` / `guest-…`, the recorder
 * `EG_…` — none of those can belong to an account.
 */

const isAccountIdentity = (identity: string) =>
  !!identity && !/^(anon-|guest-|EG_)/.test(identity)

/** Remove the person from every room in progress; returns how many seats were freed. */
export async function ejectFromAllRooms(user: Pick<User, 'id' | 'sub'>): Promise<number> {
  const identities = new Set([user.sub, user.id].filter((v): v is string => !!v))
  const rooms = await roomService.listRooms()
  let removed = 0
  for (const room of rooms) {
    try {
      const participants = await roomService.listParticipants(room.name)
      for (const p of participants) {
        if (!identities.has(p.identity)) continue
        await roomService.removeParticipant(room.name, p.identity)
        removed++
      }
    } catch (err) {
      // The room ended meanwhile, or one call failed: carry on with the others.
      logger.warn(`[eject] room ${room.name}: ${(err as Error).message}`)
    }
  }
  return removed
}

/** On a join: is this a deactivated account? Then remove it. Returns true if removed. */
export async function ejectIfDeactivated(roomName: string, identity: string): Promise<boolean> {
  if (!isAccountIdentity(identity)) return false
  const deactivated = await prisma.user.findFirst({
    where: { isActive: false, OR: [{ sub: identity }, { id: identity }] },
    select: { id: true },
  })
  if (!deactivated) return false
  await roomService.removeParticipant(roomName, identity)
  logger.warn(`[eject] deactivated account ${deactivated.id} removed from ${roomName} on join`)
  return true
}
