import { env } from '../config/env'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { decryptToken, encryptToken } from '../lib/tokenCrypto'
import { idTokenClaims } from '../lib/googleEvent'
import { getSetting } from './settings'

/**
 * Google Calendar through each user's own OAuth consent (phase 2). Plain HTTP
 * against Google's REST endpoints: the official `googleapis` package would add
 * ~100 MB for four calls.
 */
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const SCOPES = ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/calendar.events']

export const googleCallbackUrl = () => new URL('/api/v1.0/me/google/callback/', env.APP_BASE_URL).toString()

/** Credentials installed on the server AND switched on by an administrator. */
export async function isGoogleSyncEnabled(): Promise<boolean> {
  return env.google.configured && (await getSetting('calendar.enabled')) && (await getSetting('calendar.google.enabled'))
}

/** Raised when the user's consent is gone (revoked, expired): they must reconnect. */
export class GoogleConsentLost extends Error {}

export function consentUrl(state: string, email: string): string {
  const params = new URLSearchParams({
    client_id: env.google.clientId,
    redirect_uri: googleCallbackUrl(),
    response_type: 'code',
    scope: SCOPES.join(' '),
    // offline + consent: Google returns a refresh token every time, so a
    // reconnection after a revocation always works.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
    login_hint: email,
    // Steer the account chooser to the institutional domain.
    hd: email.split('@')[1] ?? '',
  })
  return `${AUTH_URL}?${params}`
}

async function tokenRequest(body: Record<string, string>) {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env.google.clientId, client_secret: env.google.clientSecret, ...body }),
    signal: AbortSignal.timeout(10_000),
  })
  const json = (await response.json().catch(() => ({}))) as Record<string, string | number | undefined>
  return { ok: response.ok, json }
}

/**
 * Finish the consent: exchange the code, check the Google account is the
 * user's own address, store the refresh token encrypted.
 */
export async function linkAccount(userId: string, userEmail: string, code: string): Promise<string> {
  const { ok, json } = await tokenRequest({
    code,
    grant_type: 'authorization_code',
    redirect_uri: googleCallbackUrl(),
  })
  if (!ok || !json.refresh_token || !json.id_token) {
    throw new Error(`token exchange failed: ${json.error ?? 'no refresh token'}`)
  }
  const { email, emailVerified } = idTokenClaims(String(json.id_token))
  if (!emailVerified || email !== userEmail.toLowerCase()) {
    // A different Google account would put meetings in someone else's agenda.
    await revoke(String(json.refresh_token)).catch(() => undefined)
    throw new MismatchedAccount(email)
  }
  if (!String(json.scope ?? '').includes('calendar.events')) {
    await revoke(String(json.refresh_token)).catch(() => undefined)
    throw new Error('calendar scope not granted')
  }
  const data = {
    googleEmail: email,
    refreshToken: encryptToken(String(json.refresh_token), env.google.tokenKey),
    scope: String(json.scope ?? ''),
  }
  await prisma.googleAccount.upsert({ where: { userId }, create: { userId, ...data }, update: data })
  accessCache.delete(userId)
  return email
}

export class MismatchedAccount extends Error {
  constructor(public googleEmail: string) {
    super(`Google account ${googleEmail} does not match`)
  }
}

async function revoke(token: string) {
  await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
  })
}

/** Remove the link, revoking the token at Google (best effort). */
export async function unlinkAccount(userId: string): Promise<void> {
  const account = await prisma.googleAccount.findUnique({ where: { userId } })
  if (!account) return
  try {
    await revoke(decryptToken(account.refreshToken, env.google.tokenKey))
  } catch (err) {
    logger.warn(`[google] revoke failed for ${userId}: ${(err as Error).message}`)
  }
  await prisma.googleAccount.delete({ where: { userId } })
  accessCache.delete(userId)
}

// Access tokens live an hour; keep them in memory rather than refreshing per call.
const accessCache = new Map<string, { token: string; expiresAt: number }>()

async function accessToken(userId: string): Promise<string> {
  const cached = accessCache.get(userId)
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token
  const account = await prisma.googleAccount.findUnique({ where: { userId } })
  if (!account) throw new GoogleConsentLost('not linked')
  const { ok, json } = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: decryptToken(account.refreshToken, env.google.tokenKey),
  })
  if (!ok) {
    if (json.error === 'invalid_grant') {
      // Revoked or expired consent: forget it so the UI offers to reconnect.
      await prisma.googleAccount.delete({ where: { userId } }).catch(() => undefined)
      accessCache.delete(userId)
      throw new GoogleConsentLost('consent revoked')
    }
    throw new Error(`token refresh failed: ${json.error ?? 'unknown'}`)
  }
  const token = String(json.access_token)
  accessCache.set(userId, { token, expiresAt: Date.now() + Number(json.expires_in ?? 3600) * 1000 })
  return token
}

/** Is this user's Google Calendar linked? */
export async function linkedAccount(userId: string) {
  return prisma.googleAccount.findUnique({
    where: { userId },
    select: { googleEmail: true, connectedAt: true },
  })
}

async function calendarCall<T>(
  userId: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T | null> {
  const response = await fetch(`${EVENTS_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken(userId)}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  })
  // Already gone on Google's side (deleted by hand): nothing left to do.
  if (method === 'DELETE' && (response.status === 404 || response.status === 410)) return null
  if (response.status === 401) {
    accessCache.delete(userId)
    throw new GoogleConsentLost('unauthorized')
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Calendar API ${method} ${response.status}: ${text.slice(0, 300)}`)
  }
  return response.status === 204 ? null : ((await response.json()) as T)
}

// sendUpdates=all: Google emails the guests (invitation, update, cancellation).
export const googleEvents = {
  insert: (userId: string, event: unknown) =>
    calendarCall<{ id: string }>(userId, 'POST', '?sendUpdates=all', event),
  patch: (userId: string, eventId: string, event: unknown) =>
    calendarCall<{ id: string }>(userId, 'PATCH', `/${encodeURIComponent(eventId)}?sendUpdates=all`, event),
  remove: (userId: string, eventId: string) =>
    calendarCall<null>(userId, 'DELETE', `/${encodeURIComponent(eventId)}?sendUpdates=all`),
  get: (userId: string, eventId: string) =>
    calendarCall<{
      status?: string
      attendees?: { email?: string; responseStatus?: string }[]
      extendedProperties?: { private?: Record<string, string> }
    }>(userId, 'GET', `/${encodeURIComponent(eventId)}`),
}
