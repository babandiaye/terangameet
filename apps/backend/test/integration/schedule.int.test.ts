import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import { sentMails } from './setup'
import { API, createRoom, signedIn } from './helpers'

const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString()

beforeEach(async () => {
  await prisma.appSetting.create({ data: { key: 'calendar.enabled', value: true } })
})

async function plan(http: Awaited<ReturnType<typeof signedIn>>['http'], body: object) {
  const res = await http.post(`${API}/me/schedule/`, {
    title: 'Comité',
    starts_at: inHours(24),
    ends_at: inHours(25),
    ...body,
  })
  expect(res.status).toBe(201)
  return res.body.meeting as { id: string }
}

describe('Réunions programmées et liste de la salle', () => {
  it('l’annulation retire de la salle ceux que la réunion a ajoutés, pas les ajouts manuels ni les co-organisateurs', async () => {
    const org = await signedIn()
    const room = await createRoom(org.user, { accessLevel: 'RESTRICTED' })
    await prisma.roomInvitee.createMany({
      data: [
        { roomId: room.id, email: 'manuel@exemple.sn' },
        { roomId: room.id, email: 'coorg@exemple.sn', isCoOrganizer: true },
      ],
    })
    const m = await plan(org.http, {
      room_id: room.id,
      attendees: ['manuel@exemple.sn', 'coorg@exemple.sn', 'nouveau@exemple.sn'],
    })
    expect(await prisma.roomInvitee.count({ where: { roomId: room.id } })).toBe(3)

    expect((await org.http.delete(`${API}/me/schedule/${m.id}/`)).status).toBe(200)
    const left = (await prisma.roomInvitee.findMany({ where: { roomId: room.id } })).map((i) => i.email).sort()
    expect(left).toEqual(['coorg@exemple.sn', 'manuel@exemple.sn'])
    const periods = await prisma.roomInviteePeriod.findMany({ where: { roomId: room.id } })
    expect(periods.map((p) => p.email)).toEqual(['nouveau@exemple.sn'])
  })

  it('un co-organisateur ne peut pas faire retirer un autre co-organisateur via une réunion', async () => {
    const owner = await signedIn()
    const room = await createRoom(owner.user, { accessLevel: 'RESTRICTED' })
    const attacker = await signedIn()
    await prisma.roomInvitee.createMany({
      data: [
        { roomId: room.id, email: attacker.user.email!, isCoOrganizer: true },
        { roomId: room.id, email: 'victime@exemple.sn', isCoOrganizer: true },
      ],
    })
    const m = await plan(attacker.http, { room_id: room.id, attendees: ['victime@exemple.sn'] })
    await attacker.http.delete(`${API}/me/schedule/${m.id}/`)
    const victim = await prisma.roomInvitee.findFirst({ where: { roomId: room.id, email: 'victime@exemple.sn' } })
    expect(victim?.isCoOrganizer).toBe(true)
  })

  it('garde la place d’un invité attendu à une autre réunion à venir de la salle', async () => {
    const org = await signedIn()
    const room = await createRoom(org.user, { accessLevel: 'RESTRICTED' })
    const first = await plan(org.http, { room_id: room.id, attendees: ['x@exemple.sn'] })
    await plan(org.http, { room_id: room.id, attendees: ['x@exemple.sn'], starts_at: inHours(48), ends_at: inHours(49) })
    await org.http.delete(`${API}/me/schedule/${first.id}/`)
    expect(await prisma.roomInvitee.count({ where: { roomId: room.id, email: 'x@exemple.sn' } })).toBe(1)
  })

  it('n’écrit qu’aux nouveaux invités quand seule la description change, à tous si l’heure change', async () => {
    const org = await signedIn()
    const m = await plan(org.http, { attendees: ['a@exemple.sn', 'b@exemple.sn'] })
    sentMails.length = 0

    expect((await org.http.patch(`${API}/me/schedule/${m.id}/`, { description: 'Ordre du jour' })).status).toBe(200)
    expect(sentMails).toHaveLength(0)

    await org.http.patch(`${API}/me/schedule/${m.id}/`, { attendees: ['a@exemple.sn', 'b@exemple.sn', 'c@exemple.sn'] })
    expect(sentMails.map((s) => s.to).filter((t) => t !== org.user.email)).toEqual(['c@exemple.sn'])
    sentMails.length = 0

    await org.http.patch(`${API}/me/schedule/${m.id}/`, { starts_at: inHours(30), ends_at: inHours(31) })
    expect(sentMails.map((s) => s.to).filter((t) => t !== org.user.email).sort()).toEqual([
      'a@exemple.sn',
      'b@exemple.sn',
      'c@exemple.sn',
    ])
  })

  it('décompte chaque mail de mise à jour du quota (30 en test)', async () => {
    const org = await signedIn()
    const guests = Array.from({ length: 12 }, (_, i) => `g${i}@exemple.sn`)
    const m = await plan(org.http, { attendees: guests }) // 12
    await org.http.patch(`${API}/me/schedule/${m.id}/`, { starts_at: inHours(30), ends_at: inHours(31) }) // 24
    const res = await org.http.patch(`${API}/me/schedule/${m.id}/`, { starts_at: inHours(32), ends_at: inHours(33) })
    expect(res.status).toBe(429)
  })

  it('refuse d’annuler une réunion déjà passée', async () => {
    const org = await signedIn()
    const room = await createRoom(org.user)
    const past = await prisma.scheduledMeeting.create({
      data: {
        roomId: room.id,
        organizerId: org.user.id,
        title: 'Passée',
        startsAt: new Date(Date.now() - 3 * 3600_000),
        endsAt: new Date(Date.now() - 2 * 3600_000),
      },
    })
    expect((await org.http.delete(`${API}/me/schedule/${past.id}/`)).status).toBe(409)
  })

  it('seul l’organisateur modifie ou annule sa réunion', async () => {
    const org = await signedIn()
    const m = await plan(org.http, { attendees: [] })
    const other = await signedIn()
    expect((await other.http.patch(`${API}/me/schedule/${m.id}/`, { title: 'Pirate' })).status).toBe(404)
    expect((await other.http.delete(`${API}/me/schedule/${m.id}/`)).status).toBe(404)
  })
})

describe('Création fiable (C6)', () => {
  it('une requête rejouée avec la même clé ne crée pas une seconde réunion', async () => {
    const org = await signedIn()
    const body = { title: 'Conseil', starts_at: inHours(24), ends_at: inHours(25), attendees: ['a@exemple.sn'] }
    const first = await org.http.post(`${API}/me/schedule/`, body).set('Idempotency-Key', 'cle-essai-0001')
    expect(first.status).toBe(201)
    const again = await org.http.post(`${API}/me/schedule/`, body).set('Idempotency-Key', 'cle-essai-0001')
    expect(again.status).toBe(200)
    expect(again.body.meeting.id).toBe(first.body.meeting.id)
    expect(await prisma.scheduledMeeting.count()).toBe(1)
    expect(sentMails.filter((m) => m.to === 'a@exemple.sn')).toHaveLength(1)
  })

  it('une requête refusée libère la clé pour un nouvel essai', async () => {
    const org = await signedIn()
    const bad = await org.http
      .post(`${API}/me/schedule/`, { title: '', starts_at: inHours(24), ends_at: inHours(25) })
      .set('Idempotency-Key', 'cle-essai-0002')
    expect(bad.status).toBe(400)
    const ok = await org.http
      .post(`${API}/me/schedule/`, { title: 'Bon', starts_at: inHours(24), ends_at: inHours(25) })
      .set('Idempotency-Key', 'cle-essai-0002')
    expect(ok.status).toBe(201)
  })

  it('une longue liste part en arrière-plan sans faire attendre la réponse', async () => {
    const org = await signedIn()
    const guests = Array.from({ length: 25 }, (_, i) => `l${i}@exemple.sn`)
    const res = await org.http.post(`${API}/me/schedule/`, {
      title: 'Assemblée',
      starts_at: inHours(24),
      ends_at: inHours(25),
      attendees: guests,
    })
    expect(res.status).toBe(201)
    expect(res.body.mail).toMatchObject({ queued: true, sent: 25 })
    await expect.poll(() => sentMails.length).toBeGreaterThanOrEqual(25)
  })
})
