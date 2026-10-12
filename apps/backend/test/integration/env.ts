import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'dotenv'

/**
 * Load .env.test into process.env (before the app reads its configuration) and
 * refuse to go on unless the database is a *_test one and Redis is not index 0
 * or the production index. In CI the variables come from the workflow instead.
 */
export function loadTestEnv(): void {
  const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../.env.test')
  if (fs.existsSync(file)) {
    for (const [k, v] of Object.entries(parse(fs.readFileSync(file)))) process.env[k] = v
  }
  process.env.NODE_ENV = 'test'
  const db = process.env.DATABASE_URL ?? ''
  const name = db.split('?')[0].split('/').pop() ?? ''
  if (!name.endsWith('_test')) {
    throw new Error(`Tests d'intégration refusés : la base « ${name || '(vide)'} » ne se termine pas par _test.`)
  }
  const redisIndex = Number((process.env.REDIS_URL ?? '').split('/').pop())
  if (!(redisIndex >= 10)) {
    throw new Error('Tests d’intégration refusés : REDIS_URL doit viser une base Redis dédiée (n° 10 ou plus).')
  }
}
