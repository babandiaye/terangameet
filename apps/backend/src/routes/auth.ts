import { Router } from 'express'
import { getOidcClient, redirectUri, pkce } from '../auth/oidc'
import { env } from '../config/env'
import { prisma } from '../lib/prisma'
import { logger } from '../lib/logger'
import { postLoginTarget, safeReturnTo } from '../lib/postLogin'

export const authRouter = Router()

function computeNames(claims: Record<string, unknown>) {
  const get = (k: string) => (typeof claims[k] === 'string' ? (claims[k] as string) : '')
  const fullName =
    env.oidc.fullnameFields.map(get).filter(Boolean).join(' ').trim() ||
    get('name') ||
    get('preferred_username') ||
    get('email')
  const shortName = get(env.oidc.shortnameField) || fullName.split(' ')[0] || ''
  return { fullName, shortName }
}

/** GET /api/v1.0/authenticate/?silent=bool&returnTo=url */
authRouter.get('/authenticate/', async (req, res) => {
  const silent = String(req.query.silent) === 'true'
  const returnTo = (req.query[env.oidc.redirectFieldName] as string) || env.APP_BASE_URL

  // Already logged in → straight back.
  if (req.session.userId) {
    return res.redirect(
      silent ? safeReturnTo(returnTo, env.APP_BASE_URL) : postLoginTarget(returnTo, env.APP_BASE_URL, !!req.user?.isStaff)
    )
  }

  try {
    const client = await getOidcClient()
    const state = pkce.state()
    const nonce = pkce.nonce()
    const params: Record<string, string> = {
      scope: env.oidc.scopes,
      state,
      nonce,
    }
    let codeVerifier: string | undefined
    if (env.oidc.usePkce) {
      codeVerifier = pkce.codeVerifier()
      params.code_challenge = pkce.codeChallenge(codeVerifier)
      params.code_challenge_method = 'S256'
    }
    if (silent) params.prompt = 'none'

    req.session.oidc = { codeVerifier, state, nonce, returnTo, silent }
    const url = client.authorizationUrl(params)
    res.redirect(url)
  } catch (err) {
    logger.error('[auth] authenticate failed', err)
    res.status(500).json({ detail: 'Authentication provider unavailable.' })
  }
})

/** GET /oidc/callback/ */
authRouter.get('/callback/', async (req, res) => {
  const flow = req.session.oidc
  if (!flow) {
    return res.redirect(env.APP_BASE_URL)
  }
  delete req.session.oidc

  try {
    const client = await getOidcClient()
    const params = client.callbackParams(req)

    // Silent login that requires interaction → just go back, unauthenticated.
    if (flow.silent && params.error) {
      return res.redirect(safeReturnTo(flow.returnTo, env.APP_BASE_URL))
    }

    const tokenSet = await client.callback(redirectUri(), params, {
      state: flow.state,
      nonce: flow.nonce,
      code_verifier: flow.codeVerifier,
    })

    const claims = { ...tokenSet.claims() }
    let info: Record<string, unknown> = claims
    try {
      if (tokenSet.access_token) {
        info = { ...claims, ...(await client.userinfo(tokenSet.access_token)) }
      }
    } catch {
      /* userinfo optional */
    }

    const sub = String(info.sub ?? claims.sub ?? '')
    const email = typeof info.email === 'string' ? info.email : null
    const { fullName, shortName } = computeNames(info)

    const user = await upsertUser({ sub, email, fullName, shortName })
    if (!user) {
      return res.redirect(safeReturnTo(flow.returnTo, env.APP_BASE_URL))
    }

    req.session.userId = user.id
    // Keep the (possibly long) id token for clean RP-initiated logout.
    ;(req.session as unknown as { idToken?: string }).idToken = tokenSet.id_token
    res.redirect(
      flow.silent
        ? safeReturnTo(flow.returnTo, env.APP_BASE_URL)
        : postLoginTarget(flow.returnTo, env.APP_BASE_URL, user.isStaff)
    )
  } catch (err) {
    if (flow.silent) {
      return res.redirect(safeReturnTo(flow.returnTo, env.APP_BASE_URL))
    }
    logger.error('[auth] callback failed', err)
    res.status(500).json({ detail: 'Authentication failed.' })
  }
})

async function upsertUser(data: {
  sub: string
  email: string | null
  fullName: string
  shortName: string
}) {
  if (!data.sub) return null

  // Bootstrap admins from config (never demotes a manually-promoted admin).
  const isBootstrapAdmin = !!data.email && env.adminEmails.includes(data.email.toLowerCase())
  const staffPatch = isBootstrapAdmin ? { isStaff: true } : {}

  const existing = await prisma.user.findUnique({ where: { sub: data.sub } })
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { email: data.email, fullName: data.fullName, shortName: data.shortName, ...staffPatch },
    })
  }

  // Fallback: match by email (account created under a different idp sub).
  if (env.oidc.fallbackToEmail && data.email) {
    const byEmail = await prisma.user.findFirst({ where: { email: data.email, sub: null } })
    if (byEmail) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: { sub: data.sub, fullName: data.fullName, shortName: data.shortName, ...staffPatch },
      })
    }
  }

  if (!env.oidc.createUser) return null
  return prisma.user.create({
    data: {
      sub: data.sub,
      email: data.email,
      fullName: data.fullName,
      shortName: data.shortName,
      language: env.language.default,
      timezone: env.language.timezone,
      ...staffPatch,
    },
  })
}

/** GET /api/v1.0/logout */
authRouter.get('/logout', async (req, res) => {
  const idToken = (req.session as unknown as { idToken?: string }).idToken
  req.session.destroy(async () => {
    res.clearCookie(env.SESSION_COOKIE_NAME)
    try {
      const client = await getOidcClient()
      const endSession = client.issuer.metadata.end_session_endpoint
      if (endSession) {
        const url = client.endSessionUrl({
          id_token_hint: idToken,
          post_logout_redirect_uri: env.APP_BASE_URL,
        })
        return res.redirect(url)
      }
    } catch {
      /* fall through */
    }
    res.redirect(env.APP_BASE_URL)
  })
})
