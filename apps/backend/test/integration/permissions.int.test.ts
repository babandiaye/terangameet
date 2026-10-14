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

function meetingIn(room: Room, organizer: User) {
  return prisma.scheduledMeeting.create({
    data: {
      roomId: room.id,
      organizerId: organizer.id,
      title: 'Réunion',
      startsAt: new Date(Date.now() + 3600_000),
      endsAt: new Date(Date.now() + 2 * 3600_000),
    },
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

  it('un membre ajouté à la salle voit tous ses enregistrements, même antérieurs à son ajout', async () => {
    const owner = await signedIn()
    const room = await createRoom(owner.user)
    const before = await recordingIn(room, { at: new Date(Date.now() - 86_400_000) })
    const member = await signedIn()
    const add = await owner.http.post(`${API}/me/rooms/${room.id}/invitees/`, { emails: [member.user.email!] })
    expect(add.status).toBe(201)
    const after = await recordingIn(room)
    expect(await canSee(member.http, before.id)).toBe(200)
    expect(await canSee(member.http, after.id)).toBe(200)
    const list = await member.http.get(`${API}/recordings/`)
    expect(list.body.results.map((r: { id: string }) => r.id)).toEqual(expect.arrayContaining([before.id, after.id]))
  })

  it('un invité d’une réunion programmée ne voit que les enregistrements faits depuis son ajout', async () => {
    const owner = await createUser()
    const room = await createRoom(owner)
    const meeting = await meetingIn(room, owner)
    const before = await recordingIn(room, { at: new Date(Date.now() - 86_400_000) })
    const guest = await signedIn()
    await prisma.roomInvitee.create({ data: { roomId: room.id, email: guest.user.email!, addedByMeetingId: meeting.id } })
    const after = await recordingIn(room)
    expect(await canSee(guest.http, after.id)).toBe(200)
    expect(await canSee(guest.http, before.id)).toBe(404)
  })

  it('un non-membre présent à une séance enregistrée voit cet enregistrement, pas les autres', async () => {
    const owner = await createUser()
    const room = await createRoom(owner)
    const present = await signedIn()
    const attended = await recordingIn(room, { attendee: present.user })
    const other = await recordingIn(room)
    expect(await canSee(present.http, attended.id)).toBe(200)
    expect(await canSee(present.http, other.id)).toBe(404)
  })

  it('l’invité d’une réunion ajouté ensuite à la main devient membre et voit tout l’historique', async () => {
    const owner = await signedIn()
    const room = await createRoom(owner.user)
    const meeting = await meetingIn(room, owner.user)
    const before = await recordingIn(room, { at: new Date(Date.now() - 86_400_000) })
    const guest = await signedIn()
    await prisma.roomInvitee.create({ data: { roomId: room.id, email: guest.user.email!, addedByMeetingId: meeting.id } })
    expect(await canSee(guest.http, before.id)).toBe(404)
    await owner.http.post(`${API}/me/rooms/${room.id}/invitees/`, { emails: [guest.user.email!] })
    expect(await canSee(guest.http, before.id)).toBe(200)
  })

  it('un membre retiré garde les enregistrements faits jusqu’à son retrait', async () => {
    const owner = await signedIn()
    const room = await createRoom(owner.user)
    const older = await recordingIn(room, { at: new Date(Date.now() - 3 * 86_400_000) })
    const member = await signedIn()
    const inv = await prisma.roomInvitee.create({
      data: { roomId: room.id, email: member.user.email!, createdAt: new Date(Date.now() - 2 * 86_400_000) },
    })
    const during = await recordingIn(room, { at: new Date(Date.now() - 86_400_000) })
    expect((await owner.http.delete(`${API}/me/rooms/${room.id}/invitees/${inv.id}/`)).status).toBe(200)
    const afterRemoval = await recordingIn(room)
    expect(await canSee(member.http, older.id)).toBe(200)
    expect(await canSee(member.http, during.id)).toBe(200)
    expect(await canSee(member.http, afterRemoval.id)).toBe(404)
  })

  it('un invité de réunion retiré garde seulement les enregistrements de sa période d’inscription', async () => {
    const owner = await signedIn()
    const room = await createRoom(owner.user)
    const meeting = await meetingIn(room, owner.user)
    const older = await recordingIn(room, { at: new Date(Date.now() - 3 * 86_400_000) })
    const guest = await signedIn()
    const inv = await prisma.roomInvitee.create({
      data: {
        roomId: room.id,
        email: guest.user.email!,
        addedByMeetingId: meeting.id,
        createdAt: new Date(Date.now() - 2 * 86_400_000),
      },
    })
    const during = await recordingIn(room, { at: new Date(Date.now() - 86_400_000) })
    expect((await owner.http.delete(`${API}/me/rooms/${room.id}/invitees/${inv.id}/`)).status).toBe(200)
    const afterRemoval = await recordingIn(room)
    expect(await canSee(guest.http, during.id)).toBe(200)
    expect(await canSee(guest.http, older.id)).toBe(404)
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
