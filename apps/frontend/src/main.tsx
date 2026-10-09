import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

// A tab opened before a deploy still references the previous build's hashed
// chunks. Once they are gone, the next lazy route (leaving a meeting loads the
// home page) fails to import and React renders a blank page. Reload instead,
// which fetches the new build. Only once per ten seconds: if the reload does
// not help, the error must surface rather than loop.
const CHUNK_RELOAD_KEY = 'terangameet:chunk-reload-at'
window.addEventListener('vite:preloadError', (event) => {
  let lastReload = 0
  try {
    lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY)) || 0
  } catch {
    /* storage unavailable: reload anyway, the guard is best effort */
  }
  if (Date.now() - lastReload < 10_000) return
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
  } catch {
    /* see above */
  }
  event.preventDefault()
  window.location.reload()
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
