import { Router } from "express";
import { logger } from "../../lib/logger";
import { getSetting, setSetting } from "../../services/settings";
import { z } from "zod";
import { env } from "../../config/env";
import { checkAll } from "../../services/health";
import { PURGE_PERIODS, getPurgePeriod, setPurgePeriod, countEligible, purgeRecordings } from "../../services/recordingPurge";

/** Administration — service status, calendar and recording-purge settings. */
export const systemRouter = Router();

/* ----------------------------------------------------------------- status -- */

/** GET /status/ — live health of every infrastructure dependency. */
systemRouter.get("/status/", async (_req, res) => {
  // snake_case like the rest of the API (the probes speak camelCase inside).
  const report = await checkAll();
  res.json({
    checked_at: report.checkedAt,
    components: report.components.map(({ latencyMs, ...c }) => ({
      ...c,
      latency_ms: latencyMs,
    })),
  });
});

/* --------------------------------------------------------------- calendar -- */

/**
 * GET /settings/calendar/ — whether scheduled meetings (and their calendar
 * invitations) are offered. Invitations go by email, hence `mail_configured`:
 * the toggle is pointless without SMTP and the UI says so.
 */
const calendarSettings = async () => ({
  enabled: await getSetting("calendar.enabled"),
  mail_configured: env.mail.enabled,
  google: {
    // Credentials from the DITSI installed on the server (.env.production).
    configured: env.google.configured,
    enabled: await getSetting("calendar.google.enabled"),
  },
});

systemRouter.get("/settings/calendar/", async (_req, res) => {
  res.json(await calendarSettings());
});

/** PUT /settings/calendar/ — switch the calendar on or off for everyone. */
systemRouter.put("/settings/calendar/", async (req, res) => {
  const parsed = z
    .object({ enabled: z.boolean().optional(), google_enabled: z.boolean().optional() })
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ detail: "Requête invalide." });
  if (parsed.data.enabled !== undefined) {
    await setSetting("calendar.enabled", parsed.data.enabled);
    logger.info(`[admin] calendar ${parsed.data.enabled ? "enabled" : "disabled"} by ${req.user!.email}`);
  }
  if (parsed.data.google_enabled !== undefined) {
    if (parsed.data.google_enabled && !env.google.configured) {
      return res.status(409).json({ detail: "Les identifiants Google ne sont pas installés sur le serveur." });
    }
    await setSetting("calendar.google.enabled", parsed.data.google_enabled);
    logger.info(`[admin] Google Calendar sync ${parsed.data.google_enabled ? "enabled" : "disabled"} by ${req.user!.email}`);
  }
  res.json(await calendarSettings());
});

/* ------------------------------------------------------------------ purge -- */

/** GET /purge/ — current purge configuration + how many recordings are eligible. */
systemRouter.get("/purge/", async (_req, res) => {
  if (!env.purge.enabled) return res.json({ enabled: false });
  const period = await getPurgePeriod();
  res.json({
    enabled: true,
    period,
    periods: Object.keys(PURGE_PERIODS),
    eligible_count: await countEligible(period),
  });
});

/** PUT /purge/ — change the retention period (1m | 3m | 6m | 1y). */
systemRouter.put("/purge/", async (req, res) => {
  if (!env.purge.enabled)
    return res.status(403).json({ detail: "La purge des enregistrements n’est pas activée." });
  const schema = z.object({ period: z.enum(["1m", "3m", "6m", "1y"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ detail: "Période invalide." });
  const period = await setPurgePeriod(parsed.data.period);
  res.json({
    enabled: true,
    period,
    periods: Object.keys(PURGE_PERIODS),
    eligible_count: await countEligible(period),
  });
});

/** POST /purge/run/ — purge eligible recordings now. */
systemRouter.post("/purge/run/", async (_req, res) => {
  if (!env.purge.enabled)
    return res.status(403).json({ detail: "La purge des enregistrements n’est pas activée." });
  const deleted = await purgeRecordings();
  res.json({
    deleted,
    period: await getPurgePeriod(),
    eligible_count: await countEligible(),
  });
});
