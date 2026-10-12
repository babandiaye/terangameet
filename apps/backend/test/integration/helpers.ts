import { createHmac, randomUUID } from 'node:crypto'
import request from 'supertest'
import type { Role, RoomAccessLevel, User } from '@prisma/client'
import { createApp } from '../../src/app'
import { env } from '../../src/config/env'
import { prisma } from '../../src/lib/prisma'
import { redis } from '../../src/lib/redis'

export const app = createApp()

/** Empty every table (the schema stays) and the test Redis index. */
export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  if (tables.length) {
    await prisma.$executeRawUnsafe(
      `TRUNCATE ${tables.map((t) => `"public"."${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`
    )
  }
  await redis.flushdb()
}

let seq = 0
export async function createUser(over: Partial<User> = {}): Promise<User> {
  seq += 1
  return prisma.user.create({
    data: {
      sub: `sub-${seq}-${randomUUID().slice(0, 6)}`,
      email: `user${seq}@unchk.edu.sn`,
      fullName: `Utilisateur ${seq}`,
      isActive: true,
      ...over,
    },
  })
}

export async function createRoom(
  owner: User,
  opts: { accessLevel?: RoomAccessLevel; slug?: string; name?: string } = {}
) {
  seq += 1
  return prisma.room.create({
    data: {
      name: opts.name ?? `Salle ${seq}`,
      slug: opts.slug ?? `tst-${seq}-${randomUUID().slice(0, 4)}`,
      accessLevel: opts.accessLevel ?? 'PUBLIC',
      accesses: { create: { userId: owner.id, role: 'OWNER' as Role } },
    },
  })
}

/**
 * A signed session cookie for this user, written straight into the session
 * store — the same thing the OIDC callback does after a real sign-in.
 */
export async function sessionCookie(user: User): Promise<string> {
  const sid = randomUUID()
  const session = {
    cookie: { originalMaxAge: 3_600_000, expires: new Date(Date.now() + 3_600_000), httpOnly: true, path: '/' },
    userId: user.id,
  }
  await redis.set(`tmsess:${sid}`, JSON.stringify(session), 'EX', 3600)
  const sig = createHmac('sha256', env.SESSION_SECRET).update(sid).digest('base64').replace(/=+$/, '')
  return `${env.SESSION_COOKIE_NAME}=${encodeURIComponent(`s:${sid}.${sig}`)}`
}

const CSRF = 'test-csrf-token'

/** Request helpers: optionally signed in, with the CSRF double-submit pair. */
export function as(cookie?: string) {
  const cookies = [`csrftoken=${CSRF}`, ...(cookie ? [cookie] : [])].join('; ')
  const withHeaders = (t: request.Test) => t.set('Cookie', cookies).set('X-CSRFToken', CSRF)
  return {
    get: (url: string) => withHeaders(request(app).get(url)),
    post: (url: string, body?: object) => withHeaders(request(app).post(url)).send(body ?? {}),
    patch: (url: string, body?: object) => withHeaders(request(app).patch(url)).send(body ?? {}),
    delete: (url: string) => withHeaders(request(app).delete(url)),
  }
}

export async function signedIn(over: Partial<User> = {}) {
  const user = await createUser(over)
  return { user, http: as(await sessionCookie(user)) }
}

export const API = '/api/v1.0'

/** A guest browser that keeps its cookies (session) across requests. */
export function guestBrowser() {
  const agent = request.agent(app)
  const withHeaders = (t: request.Test) => t.set('Cookie', `csrftoken=${CSRF}`).set('X-CSRFToken', CSRF)
  return {
    post: (url: string, body?: object) => withHeaders(agent.post(url)).send(body ?? {}),
  }
}
