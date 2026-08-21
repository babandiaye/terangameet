import type { DashboardMetrics } from './metrics'
import { formatDuration, formatTime } from './metrics'

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

/**
 * Client-side PDF export: opens a print-friendly window with a formatted snapshot
 * of the current dashboard, then triggers the browser's print/save-as-PDF dialog.
 */
export function exportDashboardPdf(metrics: DashboardMetrics, roomName: string) {
  const win = window.open('', '_blank', 'width=900,height=1000')
  if (!win) return

  const speakingTotal = metrics.totalSpeakingMs || 1
  const participantRows = metrics.participants
    .map((p) => {
      const share = Math.round((p.speakingMs / speakingTotal) * 100)
      return `<tr>
        <td>${esc(p.name)}${p.isLocal ? ' (vous)' : ''}</td>
        <td>${formatDuration(p.speakingMs)} (${share}%)</td>
        <td>${p.messageCount}</td>
        <td>${p.handRaiseCount}</td>
        <td>${p.online ? 'En ligne' : 'Parti'}</td>
      </tr>`
    })
    .join('')

  const perfRow = (label: string, value: number) =>
    `<tr><td>${label}</td><td><b>${value}%</b></td></tr>`

  win.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
  <title>Rapport de réunion — ${esc(roomName)}</title>
  <style>
    body{font-family:system-ui,Arial,sans-serif;color:#1f2937;margin:32px;}
    h1{font-size:20px;margin:0 0 4px;} .sub{color:#6b7280;margin:0 0 20px;}
    .cards{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px;}
    .card{border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px;min-width:140px;}
    .card .l{font-size:11px;text-transform:uppercase;color:#6b7280;letter-spacing:.05em;}
    .card .v{font-size:22px;font-weight:700;}
    table{width:100%;border-collapse:collapse;margin:8px 0 20px;font-size:13px;}
    th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #eee;}
    th{color:#6b7280;font-weight:600;text-transform:uppercase;font-size:11px;}
    h2{font-size:14px;margin:18px 0 6px;}
  </style></head><body>
    <h1>Tableau de bord — Rapport de réunion</h1>
    <p class="sub">${esc(roomName)} · généré le ${formatTime(Date.now())}</p>
    <div class="cards">
      <div class="card"><div class="l">Durée</div><div class="v">${formatDuration(metrics.durationMs)}</div></div>
      <div class="card"><div class="l">Participants</div><div class="v">${metrics.participantsTotal}</div></div>
      <div class="card"><div class="l">Messages</div><div class="v">${metrics.totalMessages}</div></div>
      <div class="card"><div class="l">Tps parole</div><div class="v">${formatDuration(metrics.totalSpeakingMs)}</div></div>
      <div class="card"><div class="l">Mains levées</div><div class="v">${metrics.totalHandRaises}</div></div>
      <div class="card"><div class="l">Score global</div><div class="v">${metrics.scoreGlobal}/100</div></div>
    </div>
    <h2>Temps de parole par participant</h2>
    <table><thead><tr><th>Participant</th><th>Parole</th><th>Messages</th><th>Mains</th><th>Statut</th></tr></thead>
    <tbody>${participantRows}</tbody></table>
    <h2>Performance de la réunion</h2>
    <table><tbody>
      ${perfRow('Participation vocale', metrics.participationVocale)}
      ${perfRow('Répartition équitable', metrics.repartitionEquitable)}
      ${perfRow('Interactivité chat', metrics.chatInteractivite)}
      ${perfRow('Score global', metrics.scoreGlobal)}
    </tbody></table>
  </body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 250)
}
