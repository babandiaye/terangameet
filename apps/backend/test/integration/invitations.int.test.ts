import { describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import { sentMails } from './setup'
import { API, createRoom, createUser, signedIn } from './helpers'

const emails = (n: number, tag: string) => Array.from({ length: n }, (_, i) => `${tag}${i}@exemple.sn`)

describe('Invitation par email (POST /rooms/:id/invite/)', () => {
  it('refuse un compte qui n’organise pas la salle, sans envoyer de mail', async () => {
    const owner = await createUser()
    const room = await createRoom(owner)
    const other = await signedIn()
    const res = await other.http.post(`${API}/rooms/${room.slug}/invite/`, { emails: ['a@exemple.sn'] })
    expect(res.status).toBe(403)
    expect(sentMails).toHaveLength(0)
  })

  it('accepte l’organisateur et un co-organisateur', async () => {
    const owner = await signedIn()
    const room = await createRoom(owner.user)
    const coOrg = await signedIn()
    await prisma.roomInvitee.create({ data: { roomId: room.id, email: coOrg.user.email!, isCoOrganizer: true } })
    expect((await owner.http.post(`${API}/rooms/${room.slug}/invite/`, { emails: ['a@exemple.sn'] })).status).toBe(200)
    expect((await coOrg.http.post(`${API}/rooms/${room.slug}/invite/`, { emails: ['b@exemple.sn'] })).status).toBe(200)
    expect(sentMails.map((m) => m.to)).toEqual(['a@exemple.sn', 'b@exemple.sn'])
  })

  it('répond 404 pour une salle inexistante', async () => {
    const someone = await signedIn()
    const res = await someone.http.post(`${API}/rooms/nexiste-pas/invite/`, { emails: ['a@exemple.sn'] })
    expect(res.status).toBe(404)
  })

  it('applique le quota quotidien de destinataires (30 en test), liste refusée en entier', async () => {
    const owner = await signedIn()
    const room = await createRoom(owner.user)
    expect((await owner.http.post(`${API}/rooms/${room.slug}/invite/`, { emails: emails(20, 'a') })).status).toBe(200)
    const res = await owner.http.post(`${API}/rooms/${room.slug}/invite/`, { emails: emails(20, 'b') })
    expect(res.status).toBe(429)
    expect(res.body.detail).toContain('10')
    expect(sentMails).toHaveLength(20)
  })

  it('n’applique pas le quota aux administrateurs de la plateforme', async () => {
    const admin = await signedIn({ isStaff: true })
    const room = await createRoom(admin.user)
    for (const tag of ['a', 'b']) {
      expect((await admin.http.post(`${API}/rooms/${room.slug}/invite/`, { emails: emails(20, tag) })).status).toBe(200)
    }
  })
})
