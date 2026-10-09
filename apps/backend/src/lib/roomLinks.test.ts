import { describe, expect, it } from 'vitest'
import { roomUrlFrom } from './roomLinks'

describe('roomUrlFrom', () => {
  it('builds the public link from the slug', () => {
    expect(roomUrlFrom('https://terangameet.unchk.sn', { slug: 'xrz-hnrt-nej', id: 'uuid' })).toBe(
      'https://terangameet.unchk.sn/xrz-hnrt-nej'
    )
  })

  it('tolerates a trailing slash on the base URL', () => {
    expect(roomUrlFrom('https://terangameet.unchk.sn/', { slug: 'abc-defg-hij', id: 'uuid' })).toBe(
      'https://terangameet.unchk.sn/abc-defg-hij'
    )
  })

  it('falls back to the id for a room without slug', () => {
    expect(roomUrlFrom('https://terangameet.unchk.sn', { slug: null, id: 'uuid-1' })).toBe(
      'https://terangameet.unchk.sn/uuid-1'
    )
  })
})
