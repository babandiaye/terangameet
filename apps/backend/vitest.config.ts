import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Unit tests are pure (no DB, no network); they run anywhere with no setup.
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globals: true,
  },
})
