import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../config/env'

let transporter: Transporter | null = null

/** Lazily-built SMTP transport (singleton). Configured from env.mail. */
function getTransport(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      // secure=true means implicit TLS (port 465). On 587 we use STARTTLS instead.
      secure: env.mail.useSsl,
      requireTLS: env.mail.useTls && !env.mail.useSsl,
      auth: env.mail.user ? { user: env.mail.user, pass: env.mail.password } : undefined,
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
}

/** Send one email. Throws if SMTP is not configured. */
export async function sendMail(msg: MailMessage): Promise<void> {
  if (!env.mail.enabled) throw new Error('SMTP is not configured')
  const from = env.mail.fromName ? `${env.mail.fromName} <${env.mail.from}>` : env.mail.from
  const { icalEvent, ...rest } = msg
  await getTransport().sendMail({
    from,
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
