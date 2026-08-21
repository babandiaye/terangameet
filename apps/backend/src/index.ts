import { createApp } from './app'
import { env, validateEnv } from './config/env'
import { prisma } from './lib/prisma'
import { logger } from './lib/logger'
import { startPurgeScheduler } from './services/recordingPurge'

async function main() {
  validateEnv() // fail fast on insecure/missing configuration (hard error in prod)
  const app = createApp()

  const server = app.listen(env.PORT, env.BIND_HOST, () => {
    logger.info(
      `[server] TerangaMeet backend listening on ${env.BIND_HOST}:${env.PORT} (${env.NODE_ENV})`
    )
  })

  const stopPurge = startPurgeScheduler()

  const shutdown = async (signal: string) => {
    logger.info(`[server] ${signal} received, shutting down`)
    stopPurge()
    server.close()
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => {
  logger.error('[server] fatal', err)
  process.exit(1)
})
