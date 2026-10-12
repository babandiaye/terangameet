import { execFileSync } from 'node:child_process'
import { loadTestEnv } from './env'

/** Once per run: bring the test database to the current schema. */
export default function setup() {
  loadTestEnv()
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'pipe',
    env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
  })
}
