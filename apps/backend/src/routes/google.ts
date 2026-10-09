import { Router } from 'express'
import { randomBytes } from 'node:crypto'
import { env } from '../config/env'
import { logger } from '../lib/logger'
import { requireAuth } from '../auth/middleware'
import {
  consentUrl,
  isGoogleSyncEnabled,
  linkAccount,
  linkedAccount,
  MismatchedAccount,
  unlinkAccount,
} from '../services/google'

/**
 * "Connecter mon Google Agenda": each user links their own Google Calendar by
 * OAuth consent (internal app of the unchk.edu.sn Workspace). Mounted on its
 * own path, so the router-wide guard cannot leak onto shared routes.
 */
export const googleRouter = Router()
googleRouter.use(requireAuth)

/** Where the consent ends, with the outcome for the agenda page to announce. */
const backToAgenda = (outcome: string) =>
  new URL(`/mon-espace/agenda?google=${outcome}`, env.APP_BASE_URL).toString()

/** GET / — is the feature offered, and is my calendar linked? */
googleRouter.get('/', async (req, res) => {
  const available = await isGoogleSyncEnabled()
  const account = available ? await linkedAccount(req.user!.id) : null
  res.json({
    available,
    connected: !!account,
    google_email: account?.googleEmail ?? null,
    connected_at: account?.connectedAt.toISOString() ?? null,
  })
})

/** GET /connect/ — off to Google's consent screen (a top-level navigation). */
googleRouter.get('/connect/', async (req, res) => {
  if (!(await isGoogleSyncEnabled()) || !req.user!.email) return res.redirect(backToAgenda('unavailable'))
  const state = randomBytes(24).toString('base64url')
  req.session.googleState = state
  res.redirect(consentUrl(state, req.user!.email))
})

/** GET /callback/ — Google sends the user back here with a code (or an error). */
googleRouter.get('/callback/', async (req, res) => {
  const expected = req.session.googleState
  delete req.session.googleState
  const { state, code, error } = req.query as Record<string, string | undefined>
  if (!expected || state !== expected) return res.redirect(backToAgenda('error'))
  if (error || !code) return res.redirect(backToAgenda(error === 'access_denied' ? 'denied' : 'error'))
  try {
    const email = await linkAccount(req.user!.id, req.user!.email!, code)
    logger.info(`[google] ${req.user!.email} linked ${email}`)
    res.redirect(backToAgenda('connected'))
  } catch (err) {
    if (err instanceof MismatchedAccount) {
      logger.warn(`[google] ${req.user!.email} tried to link ${err.googleEmail}`)
      return res.redirect(backToAgenda('mismatch'))
    }
    logger.error('[google] linking failed', err)
    res.redirect(backToAgenda('error'))
  }
})

/** DELETE / — unlink and revoke at Google. */
googleRouter.delete('/', async (req, res) => {
  await unlinkAccount(req.user!.id)
  logger.info(`[google] ${req.user!.email} unlinked`)
  res.status(204).send()
})
