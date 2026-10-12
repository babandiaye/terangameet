import { redis } from '../lib/redis'

/**
 * Idempotency keys (header `Idempotency-Key`): a request repeated with the same
 * key — the browser retried after a timeout, a double click — gets the first
 * result instead of doing the work twice (a second meeting, a second round of
 * invitations). Keys are per user and kept 24 h.
 */
const TTL_S = 24 * 3600
const PENDING = '__pending__'
const KEY_RE = /^[A-Za-z0-9_-]{8,100}$/

export type Claim =
  | { state: 'none' } // no (valid) key: proceed without protection
  | { state: 'new'; redisKey: string } // first time: do the work, then complete()
  | { state: 'pending' } // the same request is still running
  | { state: 'done'; value: string } // already done: answer with this

export async function claim(scope: string, userId: string, key: string | undefined): Promise<Claim> {
  if (!key || !KEY_RE.test(key)) return { state: 'none' }
  const redisKey = `idem:${scope}:${userId}:${key}`
  if (await redis.set(redisKey, PENDING, 'EX', TTL_S, 'NX')) return { state: 'new', redisKey }
  const value = await redis.get(redisKey)
  return !value || value === PENDING ? { state: 'pending' } : { state: 'done', value }
}

export async function complete(c: Claim, value: string): Promise<void> {
  if (c.state === 'new') await redis.set(c.redisKey, value, 'EX', TTL_S)
}

/** The work failed: let the client try again with the same key. */
export async function abandon(c: Claim): Promise<void> {
  if (c.state === 'new') await redis.del(c.redisKey)
}
