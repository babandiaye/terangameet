import { describe, expect, it } from 'vitest'
import { env } from '../config/env'
import { senderHeaders } from './mailer'

describe('senderHeaders', () => {
  it('signs with the user name and replies to the user', () => {
    const h = senderHeaders({ name: 'Papa Amadou Baba NDIAYE', email: 'papaamadoubaba.ndiaye@unchk.edu.sn' })
    expect(h.from).toEqual({ name: 'Papa Amadou Baba NDIAYE via TerangaMeet', address: env.mail.from })
    expect(h.replyTo).toBe('papaamadoubaba.ndiaye@unchk.edu.sn')
  })

  it('keeps the TerangaMeet address whatever the name', () => {
    const h = senderHeaders({ name: 'Awa "la cheffe" <x@y.sn>', email: 'awa@unchk.edu.sn' })
    expect(h.from).toMatchObject({ address: env.mail.from })
  })

  it('falls back to the email when the user has no name', () => {
    const h = senderHeaders({ name: '  ', email: 'awa@unchk.edu.sn' })
    expect(h.from).toEqual({ name: 'awa@unchk.edu.sn via TerangaMeet', address: env.mail.from })
    expect(h.replyTo).toBe('awa@unchk.edu.sn')
  })

  it('adds no Reply-To without an email', () => {
    const h = senderHeaders({ name: 'Awa Diop', email: null })
    expect(h.from).toEqual({ name: 'Awa Diop via TerangaMeet', address: env.mail.from })
    expect(h.replyTo).toBeUndefined()
  })

  it('keeps the platform sender for automatic mails', () => {
    const h = senderHeaders()
    expect(h.replyTo).toBeUndefined()
    expect(h.from).toEqual(
      env.mail.fromName ? { name: env.mail.fromName, address: env.mail.from } : env.mail.from
    )
  })
})
