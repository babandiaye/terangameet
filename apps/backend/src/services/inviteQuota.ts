import type { User } from '@prisma/client'
import { redis } from '../lib/redis'
import { env } from '../config/env'

/** Redis key of one account's counter for one (UTC) day. */
export function quotaKey(userId: string, now: Date): string {
  return `invite_quota:${userId}:${now.toISOString().slice(0, 10)}`
}

/** The answer when the day's budget would be exceeded. */
export function quotaExceeded(remaining: number) {
  return {
    detail:
      remaining > 0
        ? `Limite quotidienne d’invitations atteinte : il vous reste ${remaining} destinataire(s) aujourd’hui.`
        : 'Limite quotidienne d’invitations atteinte. Réessayez demain ou contactez un administrateur.',
  }
}

/**
 * Take `count` recipients from the account's daily budget, or none at all.
 * INCRBY is atomic, so concurrent requests cannot both slip under the limit;
 * a request that would cross it gives its share back and is refused whole —
 * never half a list sent. Platform administrators are not limited.
 */
export async function reserveInvitations(
  user: Pick<User, 'id' | 'isStaff'>,
  count: number
): Promise<{ ok: true } | { ok: false; remaining: number }> {
  const limit = env.mail.dailyRecipientQuota
  if (user.isStaff || count <= 0 || limit <= 0) return { ok: true }
  const key = quotaKey(user.id, new Date())
  const used = await redis.incrby(key, count)
  if (used === count) await redis.expire(key, 2 * 24 * 3600)
  if (used > limit) {
    await redis.decrby(key, count)
    return { ok: false, remaining: Math.max(0, limit - (used - count)) }
  }
  return { ok: true }
}

/**
 * Give back a reservation whose mails will not go out (the change was refused
 * by Google, or failed before sending). Best effort: at worst the account's
 * budget for the day is a little smaller.
 */
export async function releaseInvitations(user: Pick<User, 'id' | 'isStaff'>, count: number): Promise<void> {
  if (user.isStaff || count <= 0 || env.mail.dailyRecipientQuota <= 0) return
  await redis.decrby(quotaKey(user.id, new Date()), count).catch(() => undefined)
}
