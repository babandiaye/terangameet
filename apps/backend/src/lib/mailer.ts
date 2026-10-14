import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../config/env'

let transporter: Transporter | null = null

/**
 * Lazily-built SMTP transport (singleton). Configured from env.mail.
 *
 * Pooled: the university's server waits ~10 s before greeting (anti-spam), so
 * a new connection per email made 60 invitations take over two minutes — past
 * nginx's 120 s, answered 504 while the mails still went out. A few kept-open
 * connections pay that delay once. Explicit timeouts, so a server that stops
 * answering fails the send instead of holding the request forever.
 */
function getTransport(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      // secure=true means implicit TLS (port 465). On 587 we use STARTTLS instead.
      secure: env.mail.useSsl,
      requireTLS: env.mail.useTls && !env.mail.useSsl,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.password } : undefined,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 30_000,
      greetingTimeout: 30_000,
      socketTimeout: 60_000,
    })
  }
  return transporter
}

export interface MailMessage {
  to: string | string[]
  subject: string
  text: string
  html?: string
  /**
   * A calendar invitation (iCalendar). Sent as a text/calendar alternative,
   * which is what makes Gmail and Outlook show Yes / No / Maybe and add the
   * event — an .ics merely attached is shown as a file.
   */
  icalEvent?: { method: 'REQUEST' | 'CANCEL'; content: string }
  /** The person on whose behalf the mail goes out (see senderHeaders). */
  sender?: MailSender
}

export interface MailSender {
  name?: string | null
  email?: string | null
}

/**
 * From and Reply-To for one mail. The address stays TerangaMeet's: unchk.edu.sn
 * publishes DMARC p=reject and only Google may send for it, so a mail "from"
 * the user's own address would bounce or land in spam. The user shows as the
 * display name ("Nom via TerangaMeet") and Reply-To takes answers back to them.
 * Name and address go to nodemailer separately, which encodes them: a name with
 * accents or quotes cannot break the header.
 */
export function senderHeaders(sender?: MailSender): {
  from: string | { name: string; address: string }
  replyTo?: string
} {
  const email = sender?.email?.trim()
  const name = sender?.name?.trim() || email
  if (!name) {
    return { from: env.mail.fromName ? { name: env.mail.fromName, address: env.mail.from } : env.mail.from }
  }
  return {
    from: { name: `${name} via TerangaMeet`, address: env.mail.from },
    ...(email && email.includes('@') ? { replyTo: email } : {}),
  }
}

/** Send one email. Throws if SMTP is not configured. */
export async function sendMail(msg: MailMessage): Promise<void> {
  if (!env.mail.enabled) throw new Error('SMTP is not configured')
  const { icalEvent, sender, ...rest } = msg
  await getTransport().sendMail({
    ...senderHeaders(sender),
    ...rest,
    ...(icalEvent
      ? { icalEvent: { method: icalEvent.method, filename: 'invitation.ics', content: icalEvent.content } }
      : {}),
  })
}

/** Verify the SMTP connection (used by the status probe). No-op when disabled. */
export async function verifyMailer(): Promise<void> {
  if (!env.mail.enabled) return
  await getTransport().verify()
}
