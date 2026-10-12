import { describe, expect, it } from 'vitest'
import { API, createRoom, guestBrowser, signedIn } from './helpers'

async function waitingRoom() {
  const owner = await signedIn()
  const room = await createRoom(owner.user, { accessLevel: 'PUBLIC_LOBBY' })
  const guest = guestBrowser()
  const first = await guest.post(`${API}/rooms/${room.slug}/request-entry/`, { username: 'Awa' })
  expect(first.body.status).toBe('waiting')
  const list = await owner.http.get(`${API}/rooms/${room.slug}/waiting-participants/`)
  expect(list.status).toBe(200)
  expect(list.body.participants).toHaveLength(1)
  return { owner, room, guest, id: list.body.participants[0].id as string }
}

describe('Salle d’attente', () => {
  it('un invité accepté reçoit son jeton à la demande suivante', async () => {
    const { owner, room, guest, id } = await waitingRoom()
    const decision = await owner.http.post(`${API}/rooms/${room.slug}/enter/`, { participant_id: id, allow_entry: true })
    expect(decision.status).toBe(200)
    const next = await guest.post(`${API}/rooms/${room.slug}/request-entry/`, { username: 'Awa' })
    expect(next.body.status).toBe('accepted')
    expect(next.body.livekit?.token).toBeTruthy()
  })

  it('une nouvelle demande pendant l’attente ne défait pas l’acceptation', async () => {
    const { owner, room, guest, id } = await waitingRoom()
    await owner.http.post(`${API}/rooms/${room.slug}/enter/`, { participant_id: id, allow_entry: true })
    // Two polls at once, as a browser may send right after the decision.
    const [a, b] = await Promise.all([
      guest.post(`${API}/rooms/${room.slug}/request-entry/`, { username: 'Awa' }),
      guest.post(`${API}/rooms/${room.slug}/request-entry/`, { username: 'Awa' }),
    ])
    expect([a.body.status, b.body.status]).toContain('accepted')
  })

  it('un refus tient : redemander aussitôt reste refusé', async () => {
    const { owner, room, guest, id } = await waitingRoom()
    await owner.http.post(`${API}/rooms/${room.slug}/enter/`, { participant_id: id, allow_entry: false })
    expect((await guest.post(`${API}/rooms/${room.slug}/request-entry/`, { username: 'Awa' })).body.status).toBe('denied')
    expect((await guest.post(`${API}/rooms/${room.slug}/request-entry/`, { username: 'Awa' })).body.status).toBe('denied')
    const list = await owner.http.get(`${API}/rooms/${room.slug}/waiting-participants/`)
    expect(list.body.participants).toHaveLength(0)
  })

  it('seul un organisateur décide des entrées', async () => {
    const { room, id } = await waitingRoom()
    const other = await signedIn()
    expect((await other.http.post(`${API}/rooms/${room.slug}/enter/`, { participant_id: id, allow_entry: true })).status).toBe(403)
    expect((await other.http.get(`${API}/rooms/${room.slug}/waiting-participants/`)).status).toBe(403)
  })
})
