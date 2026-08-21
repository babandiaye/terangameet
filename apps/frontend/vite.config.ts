import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import svgr from 'vite-plugin-svgr'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  // In dev, the Node backend handles /api, /oidc and /media. We proxy them to it
  // so the frontend stays same-origin (cookies + CSRF work without CORS).
  const backendTarget = env.VITE_BACKEND_TARGET || 'http://localhost:4000'
  return {
    plugins: [
      react(),
      svgr({
        svgrOptions: {
          replaceAttrValues: { '#000': 'currentColor', '#000000': 'currentColor', '#1f1f1f': 'currentColor' },
        },
      }),
      env.VITE_ANALYZE === 'true' && visualizer({
        open: true,
        filename: 'rollup-plugin-visualizer/stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
    ],
    resolve: {
      tsconfigPaths: true
    },
    build: {
      sourcemap: env.VITE_BUILD_SOURCEMAP === 'true',
    },
    server: {
      port: parseInt(env.VITE_PORT) || 3000,
      host: env.VITE_HOST ?? 'localhost',
      allowedHosts: ['.nip.io'],
      // In a local dev setup, we proxy the backend ourselves to avoid CORS issues
      proxy: {
        '/api': { target: backendTarget, changeOrigin: true, secure: false },
        '/oidc': { target: backendTarget, changeOrigin: true, secure: false },
        '/media': { target: backendTarget, changeOrigin: true, secure: false },
      },
    },
  }
})
