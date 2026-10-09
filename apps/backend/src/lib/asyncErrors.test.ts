import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { installAsyncErrorHandling, errorHandler } from './asyncErrors'

installAsyncErrorHandling()

let server: Server
let base = ''

beforeAll(async () => {
  const app = express()
  const router = express.Router()
  router.get('/boom/', async () => {
    // What a Postgres or Redis outage looks like from a route.
    await Promise.resolve()
    throw new Error('connection terminated')
  })
  router.get('/sync-boom/', () => {
    throw new Error('sync failure')
  })
  router.get('/ok/', async (_req, res) => {
    res.json({ ok: true })
  })
  router.get('/late/', async (_req, res) => {
    res.status(200).write('partial')
    throw new Error('after headers')
  })
  router.post('/json/', express.json(), (_req, res) => {
    res.json({ ok: true })
  })
  app.use('/api', router)
  app.use(errorHandler)
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve())
  })
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())))

describe('async route errors', () => {
  it('turn into a 500 instead of an unhandled rejection', async () => {
    const response = await fetch(`${base}/api/boom/`)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ detail: 'Erreur interne du serveur. Réessayez dans un instant.' })
  })

  it('leave the server answering the next requests', async () => {
    await fetch(`${base}/api/boom/`)
    const response = await fetch(`${base}/api/ok/`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('keep the 4xx status of a client error, such as malformed JSON', async () => {
    const response = await fetch(`${base}/api/json/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ detail: 'Requête invalide.' })
  })

  it('still handle synchronous throws', async () => {
    expect((await fetch(`${base}/api/sync-boom/`)).status).toBe(500)
  })

  it('close a response whose headers were already sent', async () => {
    const response = await fetch(`${base}/api/late/`)
    expect(response.status).toBe(200)
    await expect(response.text()).rejects.toThrow()
  })
})
