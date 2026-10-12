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
  /**
   * Recording retention chosen by an administrator ('1m' | '3m' | '6m' | '1y');
   * empty falls back to PURGE_RECORDINGS_PERIOD. Kept here, not in Redis: Redis
   * does not persist, and losing a « 1 year » choice would let the daily purge
   * delete recordings people meant to keep — they are not backed up.
   */
  'purge.period': '' as string,
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
