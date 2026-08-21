import { describe, it, expect } from 'vitest'
import { probe, disabled } from './probe'

describe('probe', () => {
  it('reports ok with the detail and a latency when the check resolves', async () => {
    const r = await probe('x', 'X', async () => 'all good')
    expect(r.status).toBe('ok')
    expect(r.detail).toBe('all good')
    expect(r.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('reports down with the error message when the check throws', async () => {
    const r = await probe('x', 'X', async () => {
      throw new Error('connection refused')
    })
    expect(r.status).toBe('down')
    expect(r.detail).toBe('connection refused')
  })

  it('reports down on timeout when the check hangs', async () => {
    const r = await probe('x', 'X', () => new Promise<string>(() => {}), 50)
    expect(r.status).toBe('down')
    expect(r.detail).toBe('timeout')
  })
})

describe('disabled', () => {
  it('builds a disabled component with no latency', () => {
    const r = disabled('minio', 'MinIO', 'non configuré')
    expect(r.status).toBe('disabled')
    expect(r.latencyMs).toBeNull()
    expect(r.detail).toBe('non configuré')
  })
})
