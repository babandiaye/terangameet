import { describe, expect, it } from 'vitest'
import { backupHealth } from './backupStatus'

const now = new Date('2026-10-10T08:00:00Z').getTime()
const ok = {
  ok: true,
  finished_at: '2026-10-10T02:01:00Z',
  message: 'Sauvegarde vérifiée par restauration',
  size_bytes: 183817,
}

describe('backupHealth', () => {
  it('is ok after last night’s verified backup', () => {
    const h = backupHealth(ok, now)
    expect(h.status).toBe('ok')
    expect(h.detail).toContain('vérifiée')
    expect(h.detail).toContain('180 Ko')
  })

  it('is down when the last run failed, with its message', () => {
    const h = backupHealth({ ...ok, ok: false, message: 'Échec de la sauvegarde (ligne 83)' }, now)
    expect(h.status).toBe('down')
    expect(h.detail).toContain('ligne 83')
  })

  it('is down when no backup succeeded for more than 26 hours', () => {
    const h = backupHealth({ ...ok, finished_at: '2026-10-08T02:00:00Z' }, now)
    expect(h.status).toBe('down')
    expect(h.detail).toContain('54 h')
  })

  it('is unknown before the first run', () => {
    expect(backupHealth(null, now).status).toBe('unknown')
  })
})
