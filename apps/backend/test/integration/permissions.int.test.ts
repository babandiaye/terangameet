import { describe, expect, it } from 'vitest'
import type { Room, User } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import { API, as, createRoom, createUser, signedIn } from './helpers'

async function recordingIn(room: Room, opts: { at?: Date; attendee?: User } = {}) {
  const session = await prisma.meetingSession.create({
    data: { livekitRoomName: room.id, roomId: room.id, startedAt: opts.at ?? new Date() },
  })
  if (opts.attendee) {
    await prisma.meetingParticipant.create({
      data: { sessionId: session.id, identity: opts.attendee.sub! },
    })
  }
  return prisma.recording.create({
    data: { roomId: room.id, sessionId: session.id, mode: 'SCREEN_RECORDING', status: 'SAVED', createdAt: opts.at },
  })
}

const canSee = async (http: ReturnType<typeof as>, id: string) => (await http.get(`${API}/recordings/${id}`)).status

describe('Accès aux enregistrements', () => {
  it('propriétaire et co-organisateur absents voient tout ; un inconnu rien', async () => {
    const owner = await signedIn()
    const room = await createRoom(owner.user)
    const coOrg = await signedIn()
    await prisma.roomInvitee.create({ data: { roomId: room.id, email: coOrg.user.email!, isCoOrganizer: true } })
    const rec = await recordingIn(room)
    const detail = await owner.http.get(`${API}/recordings/${rec.id}`)
    expect(detail.status).toBe(200)
    expect(detail.body.room).toMatchObject({ id: room.id, name: room.name })
    expect(await canSee(coOrg.http, rec.id)).toBe(200)
    expect(await canSee((await signedIn()).http, rec.id)).toBe(404)
    expect(await canSee(as(), rec.id)).toBe(401)
  })

  it('un participant présent voit l’enregistrement de sa séance', async () => {
    const owner = await createUser()
    const room = await createRoom(owner)
    const present = await signedIn()
    const rec = await recordingIn(room, { attendee: present.user })
    expect(await canSee(present.http, rec.id)).toBe(200)
  })

  it('un participant prévu absent voit les enregistrements faits depuis son ajout, pas avant', async () => {
    const owner = await createUser()
    const room = await createRoom(owner)
    const before = await recordingIn(room, { at: new Date(Date.now() - 86_400_000) })
    const listed = await signedIn()
    await prisma.roomInvitee.create({ data: { roomId: room.id, email: listed.user.email! } })
    const after = await recordingIn(room)
    expect(await canSee(listed.http, after.id)).toBe(200)
    expect(await canSee(listed.http, before.id)).toBe(404)
  })

  it('une personne retirée garde les enregistrements de sa période d’inscription', async () => {
    const owner = await signedIn()
    const room = await createRoom(owner.user)
    const guest = await signedIn()
    const inv = await prisma.roomInvitee.create({
      data: { roomId: room.id, email: guest.user.email!, createdAt: new Date(Date.now() - 2 * 86_400_000) },
    })
    const during = await recordingIn(room, { at: new Date(Date.now() - 86_400_000) })
    expect((await owner.http.delete(`${API}/me/rooms/${room.id}/invitees/${inv.id}/`)).status).toBe(200)
    const afterRemoval = await recordingIn(room)
    expect(await canSee(guest.http, during.id)).toBe(200)
    expect(await canSee(guest.http, afterRemoval.id)).toBe(404)
  })
})

describe('Espaces réservés', () => {
  it('console d’administration : 401 sans compte, 403 sans droit, 200 pour un administrateur', async () => {
    expect((await as().get(`${API}/admin/users/`)).status).toBe(401)
    expect((await (await signedIn()).http.get(`${API}/admin/users/`)).status).toBe(403)
    expect((await (await signedIn({ isStaff: true })).http.get(`${API}/admin/users/`)).status).toBe(200)
  })

  it('suppression d’une salle réservée aux administrateurs', async () => {
    const owner = await signedIn()
    const room = await createRoom(owner.user)
    expect((await owner.http.delete(`${API}/rooms/${room.id}`)).status).toBe(403)
    expect(await prisma.room.count({ where: { id: room.id } })).toBe(1)
  })

  it('« Mes salles » : la salle d’un autre est introuvable', async () => {
    const owner = await createUser()
    const room = await createRoom(owner)
    const other = await signedIn()
    expect((await other.http.get(`${API}/me/rooms/${room.id}/`)).status).toBe(404)
    expect((await other.http.post(`${API}/me/rooms/${room.id}/invitees/`, { emails: ['a@exemple.sn'] })).status).toBe(404)
  })

  it('modification d’une salle : refusée à un simple participant', async () => {
    const owner = await createUser()
    const room = await createRoom(owner)
    const other = await signedIn()
    expect((await other.http.patch(`${API}/rooms/${room.id}`, { access_level: 'public' })).status).toBe(403)
  })
})
