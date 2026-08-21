import { Issuer, generators, type Client } from 'openid-client'
import { env } from '../config/env'
import { logger } from '../lib/logger'

let clientPromise: Promise<Client> | null = null

export function redirectUri(): string {
  return new URL(env.oidc.callbackPath, env.APP_BASE_URL).toString()
}

/** Lazily discover the OIDC provider and build the RP client (cached). */
export function getOidcClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      logger.info(`[oidc] discovering issuer ${env.oidc.issuer}`)
      const issuer = await Issuer.discover(env.oidc.issuer)
      const client = new issuer.Client({
        client_id: env.oidc.clientId,
        client_secret: env.oidc.clientSecret || undefined,
        redirect_uris: [redirectUri()],
        response_types: ['code'],
        token_endpoint_auth_method: env.oidc.clientSecret
          ? 'client_secret_post'
          : 'none',
      })
      logger.info('[oidc] client ready')
      return client
    })().catch((err) => {
      // Reset cache so a later request can retry discovery.
      clientPromise = null
      throw err
    })
  }
  return clientPromise
}

export const pkce = generators
