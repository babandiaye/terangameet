/**
 * Generic health-probe helper: runs an async check with a hard timeout and
 * reports status + latency. Pure (only Date.now/setTimeout) so it is unit-testable.
 */
export type HealthStatus = 'ok' | 'down' | 'disabled' | 'unknown'

export interface ComponentHealth {
  key: string
  label: string
  status: HealthStatus
  latencyMs: number | null
  detail: string
}

export const DEFAULT_TIMEOUT_MS = 3000

export async function probe(
  key: string,
  label: string,
  fn: () => Promise<string>,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<ComponentHealth> {
  const start = Date.now()
  try {
    const detail = await Promise.race([
      fn(),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ])
    return { key, label, status: 'ok', latencyMs: Date.now() - start, detail }
  } catch (err) {
    return {
      key,
      label,
      status: 'down',
      latencyMs: Date.now() - start,
      detail: (err as Error).message || 'erreur inconnue',
    }
  }
}

export const disabled = (key: string, label: string, detail: string): ComponentHealth => ({
  key,
  label,
  status: 'disabled',
  latencyMs: null,
  detail,
})
