import type { Request, Response, NextFunction } from 'express'
import { TokenVerifier } from 'livekit-server-sdk'
import { env } from '../config/env'

const verifier = new TokenVerifier(env.livekit.apiKey, env.livekit.apiSecret)

export interface LiveKitAuth {
  identity: string
  room?: string
  isAdmin: boolean
  name?: string
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      livekit?: LiveKitAuth
    }
  }
}

/**
 * Optional middleware: if an Authorization: Bearer <livekit-token> is present and
 * valid, attach the verified claims to req.livekit. Never blocks the request.
 */
export async function livekitAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.get('Authorization')
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7).trim()
    try {
      const claims = await verifier.verify(token)
      req.livekit = {
        identity: String(claims.sub ?? ''),
        room: claims.video?.room,
        isAdmin: !!claims.video?.roomAdmin,
        name: claims.name,
      }
    } catch {
      /* invalid token → ignore, fall back to session auth */
    }
  }
  next()
}
