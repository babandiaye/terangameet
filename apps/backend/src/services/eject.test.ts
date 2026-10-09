import { beforeEach, describe, expect, it, vi } from 'vitest'

const listRooms = vi.fn()
const listParticipants = vi.fn()
const removeParticipant = vi.fn()
const findFirst = vi.fn()

vi.mock('../livekit/client', () => ({
  roomService: {
    listRooms: (...a: unknown[]) => listRooms(...a),
    listParticipants: (...a: unknown[]) => listParticipants(...a),
    removeParticipant: (...a: unknown[]) => removeParticipant(...a),
  },
}))
vi.mock('../lib/prisma', () => ({ prisma: { user: { findFirst: (...a: unknown[]) => findFirst(...a) } } }))

const { ejectFromAllRooms, ejectIfDeactivated } = await import('./eject')

beforeEach(() => {
  for (const f of [listRooms, listParticipants, removeParticipant, findFirst]) f.mockReset()
  removeParticipant.mockResolvedValue(undefined)
})

describe('ejectFromAllRooms', () => {
  it('removes the person from every room where one of their identities is connected', async () => {
    listRooms.mockResolvedValue([{ name: 'room-a' }, { name: 'room-b' }, { name: 'room-c' }])
    listParticipants.mockImplementation(async (room: string) =>
      ({
        'room-a': [{ identity: 'sub-1' }, { identity: 'other' }],
        'room-b': [{ identity: 'anon-x' }],
        'room-c': [{ identity: 'u1' }],
      })[room]
    )
    const removed = await ejectFromAllRooms({ id: 'u1', sub: 'sub-1' })
    expect(removed).toBe(2)
    expect(removeParticipant).toHaveBeenCalledWith('room-a', 'sub-1')
    expect(removeParticipant).toHaveBeenCalledWith('room-c', 'u1')
    expect(removeParticipant).toHaveBeenCalledTimes(2)
  })

  it('keeps going when one room cannot be read', async () => {
    listRooms.mockResolvedValue([{ name: 'broken' }, { name: 'ok' }])
    listParticipants.mockImplementation(async (room: string) => {
      if (room === 'broken') throw new Error('gone')
      return [{ identity: 'sub-1' }]
    })
    expect(await ejectFromAllRooms({ id: 'u1', sub: 'sub-1' })).toBe(1)
  })
})

describe('ejectIfDeactivated', () => {
  it('removes a deactivated account as soon as it joins', async () => {
    findFirst.mockResolvedValue({ id: 'u1' })
    expect(await ejectIfDeactivated('room-a', 'sub-1')).toBe(true)
    expect(removeParticipant).toHaveBeenCalledWith('room-a', 'sub-1')
  })

  it('lets active accounts in', async () => {
    findFirst.mockResolvedValue(null)
    expect(await ejectIfDeactivated('room-a', 'sub-1')).toBe(false)
    expect(removeParticipant).not.toHaveBeenCalled()
  })

  it('does not look up guests and the recorder', async () => {
    expect(await ejectIfDeactivated('room-a', 'anon-123')).toBe(false)
    expect(await ejectIfDeactivated('room-a', 'guest-456')).toBe(false)
    expect(await ejectIfDeactivated('room-a', 'EG_abc')).toBe(false)
    expect(findFirst).not.toHaveBeenCalled()
  })
})
