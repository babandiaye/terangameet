import { prisma } from '../lib/prisma'

/**
 * Runtime platform settings (app_settings), each with its default. Read on
 * demand — they change rarely and a lookup by primary key is cheap — so a
 * toggle by an administrator applies immediately on every instance.
 */
const DEFAULTS = {
  /** Calendar: scheduled meetings + iCalendar invitations (off until enabled). */
  'calendar.enabled': false as boolean,
  /** Phase 2: users may link their Google Calendar (needs the OAuth client). */
  'calendar.google.enabled': false as boolean,
}

export type SettingKey = keyof typeof DEFAULTS

export async function getSetting<K extends SettingKey>(key: K): Promise<(typeof DEFAULTS)[K]> {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return (row?.value as (typeof DEFAULTS)[K] | undefined) ?? DEFAULTS[key]
}

export async function setSetting<K extends SettingKey>(key: K, value: (typeof DEFAULTS)[K]): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  })
}
