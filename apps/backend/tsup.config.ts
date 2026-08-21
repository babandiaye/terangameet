import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // Keep node_modules external; the Prisma client is generated and resolved at runtime.
  skipNodeModulesBundle: true,
  dts: false,
})
