import { beforeEach, describe, expect, it, vi } from 'vitest'

const findMany = vi.fn()
const del = vi.fn()
const deleteObject = vi.fn()

vi.mock('../lib/prisma', () => ({
  prisma: { recording: { findMany: (...a: unknown[]) => findMany(...a), delete: (...a: unknown[]) => del(...a) } },
}))
vi.mock('../lib/redis', () => ({ redis: { get: async () => '6m', set: async () => 'OK' } }))
vi.mock('../lib/s3', () => ({ deleteObject: (...a: unknown[]) => deleteObject(...a) }))

const { purgeRecordings } = await import('./recordingPurge')

beforeEach(() => {
  for (const f of [findMany, del, deleteObject]) f.mockReset()
  findMany.mockResolvedValue([
    { id: 'r1', mode: 'SCREEN_RECORDING' },
    { id: 'r2', mode: 'SCREEN_RECORDING' },
  ])
  del.mockResolvedValue({})
})

describe('purgeRecordings', () => {
  it('deletes the file, then the row', async () => {
    deleteObject.mockResolvedValue(undefined)
    expect(await purgeRecordings('6m')).toBe(2)
    expect(del).toHaveBeenCalledTimes(2)
  })

  it('keeps the row when the file could not be deleted, for the next run to retry', async () => {
    deleteObject.mockImplementation(async (key: string) => {
      if (key.includes('r1')) throw new Error('MinIO unreachable')
    })
    expect(await purgeRecordings('6m')).toBe(1)
    expect(del).toHaveBeenCalledTimes(1)
    expect(del).toHaveBeenCalledWith({ where: { id: 'r2' } })
  })
})
