import { describe, expect, it } from 'vitest'
import { prisma } from '../../src/lib/prisma'
import { API, as, createRoom, createUser, signedIn } from './helpers'

const join = (http: ReturnType<typeof as>, slug: string) => http.get(`${API}/rooms/${slug}?username=Invité`)

describe('Entrée dans une salle (GET /rooms/:id)', () => {
  it('salle publique : tout le monde reçoit un jeton', async () => {
    const owner = await createUser()
    const room = await createRoom(owner, { accessLevel: 'PUBLIC' })
    const res = await join(as(), room.slug!)
    expect(res.status).toBe(200)
    expect(res.body.livekit?.token).toBeTruthy()
  })

  it('ouverte sur validation : même un compte connecté attend, pas l’organisateur', async () => {
    const owner = await signedIn()
    const room = await createRoom(owner.user, { accessLevel: 'PUBLIC_LOBBY' })
    const visitor = await signedIn()
    expect((await join(visitor.http, room.slug!)).body.livekit).toBeUndefined()
    expect((await join(owner.http, room.slug!)).body.livekit?.token).toBeTruthy()
  })

  it('personnes de confiance : pas de jeton sans compte, jeton avec', async () => {
    const owner = await createUser()
    const room = await createRoom(owner, { accessLevel: 'TRUSTED' })
    expect((await join(as(), room.slug!)).body.livekit).toBeUndefined()
    const member = await signedIn()
    expect((await join(member.http, room.slug!)).body.livekit?.token).toBeTruthy()
  })

  it('restreinte : un participant prévu entre, un autre compte attend', async () => {
    const owner = await createUser()
    const room = await createRoom(owner, { accessLevel: 'RESTRICTED' })
    const listed = await signedIn()
    await prisma.roomInvitee.create({ data: { roomId: room.id, email: listed.user.email! } })
    const other = await signedIn()
    expect((await join(listed.http, room.slug!)).body.livekit?.token).toBeTruthy()
    expect((await join(other.http, room.slug!)).body.livekit).toBeUndefined()
  })
})

describe('Salle d’attente (POST /rooms/:id/request-entry/)', () => {
  it('refuse un invité sans compte dans une salle qui exige SENID', async () => {
    const owner = await createUser()
    for (const accessLevel of ['TRUSTED', 'RESTRICTED'] as const) {
      const room = await createRoom(owner, { accessLevel })
      const res = await as().post(`${API}/rooms/${room.slug}/request-entry/`, { username: 'X' })
      expect(res.status).toBe(401)
      expect(res.body.code).toBe('login_required')
    }
  })

  it('met en attente un compte non prévu d’une salle restreinte', async () => {
    const owner = await createUser()
    const room = await createRoom(owner, { accessLevel: 'RESTRICTED' })
    const other = await signedIn()
    const res = await other.http.post(`${API}/rooms/${room.slug}/request-entry/`, { username: 'X' })
    expect(res.body.status).toBe('waiting')
  })
})

describe('Création par lien existant (POST /rooms/) — faille U1', () => {
  it('ne donne pas de jeton pour la salle restreinte de quelqu’un d’autre', async () => {
    const owner = await createUser()
    const room = await createRoom(owner, { accessLevel: 'RESTRICTED' })
    const intruder = await signedIn()
    const res = await intruder.http.post(`${API}/rooms/`, { name: 'x', slug: room.slug })
    expect(res.body.livekit).toBeUndefined()
    expect(await prisma.roomAccess.count({ where: { roomId: room.id } })).toBe(1)
  })

  it('donne un jeton à la création d’une nouvelle salle', async () => {
    const creator = await signedIn()
    const res = await creator.http.post(`${API}/rooms/`, { name: 'Ma réunion', slug: 'abc-defg-hij' })
    expect(res.status).toBe(201)
    expect(res.body.livekit?.token).toBeTruthy()
  })
})

describe('Protections transversales', () => {
  it('refuse une écriture sans jeton CSRF', async () => {
    const { user } = await signedIn()
    const room = await createRoom(user)
    const supertest = (await import('supertest')).default
    const { app } = await import('./helpers')
    const res = await supertest(app).post(`${API}/rooms/${room.slug}/request-entry/`).send({})
    expect(res.status).toBe(403)
  })

  it('refuse un webhook LiveKit non signé', async () => {
    const res = await as().post(`${API}/rooms/webhooks-livekit/`, { event: 'room_started' })
    expect(res.status).toBe(401)
  })

  it('déconnecte un compte désactivé', async () => {
    const { user, http } = await signedIn()
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } })
    expect((await http.get(`${API}/me/dashboard/`)).status).toBe(401)
  })
})

describe('Supervision', () => {
  it('/readyz répond 200 quand la base et Redis sont joignables', async () => {
    const res = await as().get('/readyz')
    expect(res.status).toBe(200)
    expect(res.body.checks).toEqual({ database: true, redis: true })
  })
})
