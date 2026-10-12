import { defineConfig } from 'vitest/config'

/**
 * Integration tests: real HTTP requests (supertest) against the real app, on a
 * dedicated Postgres database and Redis index (.env.test). The database must be
 * named *_test — test/integration/env.ts refuses anything else, so these tests
 * can never touch production. Files run one after another (shared database).
 */
export default defineConfig({
  test: {
    include: ['test/integration/**/*.int.test.ts'],
    environment: 'node',
    globals: true,
    globalSetup: ['test/integration/globalSetup.ts'],
    setupFiles: ['test/integration/setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
})
