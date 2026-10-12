import { afterAll, beforeEach, vi } from 'vitest'
import { loadTestEnv } from './env'

loadTestEnv()

/** Every email the app would have sent, for assertions. */
export const sentMails: { to: string | string[]; subject: string }[] = []

// No network in tests: mail, LiveKit server calls and room notifications are
// replaced; tokens are still signed for real (livekit/token.ts is local).
vi.mock('../../src/lib/mailer', () => ({
  sendMail: async (msg: { to: string | string[]; subject: string }) => {
    sentMails.push({ to: msg.to, subject: msg.subject })
  },
  verifyMailer: async () => undefined,
}))
vi.mock('../../src/livekit/notify', () => ({ notifyRoom: async () => undefined }))
vi.mock('../../src/livekit/client', async () => {
  const { WebhookReceiver } = await import('livekit-server-sdk')
  const stub = new Proxy({}, { get: () => async () => [] })
  return {
    roomService: stub,
    egressClient: stub,
    webhookReceiver: new WebhookReceiver(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!),
  }
})

const { resetDatabase } = await import('./helpers')
const { prisma } = await import('../../src/lib/prisma')
const { redis } = await import('../../src/lib/redis')

beforeEach(async () => {
  sentMails.length = 0
  await resetDatabase()
})

afterAll(async () => {
  await prisma.$disconnect()
  redis.disconnect()
})
