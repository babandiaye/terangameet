import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'

const findUnique = vi.fn()
vi.mock('../lib/prisma', () => ({ prisma: { user: { findUnique: (...a: unknown[]) => findUnique(...a) } } }))

const { attachUser } = await import('./middleware')

const run = async (session: Record<string, unknown>) => {
  const req = { session } as unknown as Request
  const next = vi.fn() as unknown as NextFunction
  await attachUser(req, {} as Response, next)
  return { req, next }
}

describe('attachUser', () => {
  beforeEach(() => findUnique.mockReset())

  it('loads an active account', async () => {
    findUnique.mockResolvedValue({ id: 'u1', isActive: true })
    const { req, next } = await run({ userId: 'u1' })
    expect(req.user).toEqual({ id: 'u1', isActive: true })
    expect(req.session.userId).toBe('u1')
    expect(next).toHaveBeenCalled()
  })

  it('signs out an account an administrator deactivated', async () => {
    findUnique.mockResolvedValue({ id: 'u1', isActive: false })
    const { req, next } = await run({ userId: 'u1' })
    expect(req.user).toBeNull()
    expect(req.session.userId).toBeUndefined()
    expect(next).toHaveBeenCalled()
  })

  it('signs out an account that no longer exists', async () => {
    findUnique.mockResolvedValue(null)
    const { req } = await run({ userId: 'gone' })
    expect(req.user).toBeNull()
    expect(req.session.userId).toBeUndefined()
  })

  it('leaves a guest alone', async () => {
    const { req, next } = await run({})
    expect(findUnique).not.toHaveBeenCalled()
    expect(req.user).toBeUndefined()
    expect(next).toHaveBeenCalled()
  })
})
