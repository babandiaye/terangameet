/** Query string from optional parameters (empty values left out), e.g. "?page=2&q=sow". */
export const qs = (params: Record<string, string | number | undefined>) => {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') sp.set(k, String(v))
  })
  const s = sp.toString()
  return s ? `?${s}` : ''
}

/** The paginated envelope every list endpoint returns (backend lib/pagination.ts). */
export interface Paginated<T> {
  count: number
  page: number
  page_size: number
  results: T[]
}
