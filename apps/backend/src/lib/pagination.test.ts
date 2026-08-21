import { describe, it, expect } from 'vitest'
import { paging, paginated } from './pagination'

describe('paging', () => {
  it('defaults to page 1, size 20', () => {
    expect(paging({})).toEqual({ page: 1, pageSize: 20, skip: 0, take: 20 })
  })

  it('computes skip from page and size', () => {
    expect(paging({ page: '3', pageSize: '10' })).toEqual({ page: 3, pageSize: 10, skip: 20, take: 10 })
  })

  it('clamps invalid/out-of-range values', () => {
    expect(paging({ page: '0' }).page).toBe(1)
    expect(paging({ page: '-5' }).page).toBe(1)
    expect(paging({ pageSize: '9999' }).pageSize).toBe(100) // hard cap
    expect(paging({ pageSize: 'abc' }).pageSize).toBe(20) // fallback
  })
})

describe('paginated', () => {
  it('wraps results in the standard envelope', () => {
    expect(paginated(42, 2, 20, ['a', 'b'])).toEqual({
      count: 42,
      page: 2,
      page_size: 20,
      results: ['a', 'b'],
    })
  })
})
