import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware";
import { resolveRoom } from "../services/rooms";
import { env } from "../config/env";
import { sendMail } from "../lib/mailer";
import { inviteLimiter } from "../middleware/rateLimit";
import { logger } from "../lib/logger";

/** Email invitations to a room, mounted under /api/v1.0/rooms. */
export const inviteRouter = Router();

// requireAuth is attached per route, never with a path-less router.use(): this
// router shares the /rooms mount with the public join and lobby routes, and a
// blanket guard here answers 401 for every one of them without calling next().
const bodySchema = z.object({
  emails: z.array(z.string().trim().toLowerCase().email()).min(1).max(20),
  message: z.string().trim().max(2000).optional(),
});

/** POST /:roomId/invite/ — send the join link by email to one or more recipients. */
inviteRouter.post(
  "/:roomId/invite/",
  requireAuth,
  inviteLimiter,
  async (req, res) => {
    if (!env.mail.enabled) {
      return res
        .status(503)
        .json({ detail: "L'envoi d'emails n'est pas configuré." });
    }

    // Accept either { email: "..." } or { emails: [...] }.
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const emails = Array.isArray(raw.emails)
      ? raw.emails
      : typeof raw.email === "string"
        ? [raw.email]
        : [];

    const parsed = bodySchema.safeParse({ emails, message: raw.message });
    if (!parsed.success) {
      return res.status(400).json({ detail: "Adresse email invalide." });
    }

    const { room } = await resolveRoom(req.params.roomId);
    const slug = room?.slug ?? req.params.roomId;
    const url = `${env.APP_BASE_URL.replace(/\/$/, "")}/${slug}`;
    const inviter = req.user!.fullName || req.user!.email || "Un participant";
    const roomLabel = room?.name || slug;

    // De-duplicate recipients while preserving order.
    const recipients = [...new Set(parsed.data.emails)];
    const customMessage = parsed.data.message;

    const results = await Promise.allSettled(
      recipients.map((to) =>
        sendMail({
          to,
          subject: `${inviter} vous invite à une réunion TerangaMeet`,
          text: buildText({ inviter, url, roomLabel, customMessage }),
          html: buildHtml({ inviter, url, roomLabel, customMessage }),
        }),
      ),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = recipients.length - sent;
    if (failed > 0) {
      results.forEach((r, i) => {
        if (r.status === "rejected") {
          logger.warn(
            `[invite] failed to email ${recipients[i]}: ${String(r.reason)}`,
          );
        }
      });
    }

    if (sent === 0) {
      return res
        .status(502)
        .json({ detail: "L'envoi des invitations a échoué.", sent, failed });
    }
    res.json({ sent, failed });
  },
);

function buildText(p: {
  inviter: string;
  url: string;
  roomLabel: string;
  customMessage?: string;
}): string {
  return [
    "Bonjour,",
    "",
    `${p.inviter} vous invite à rejoindre la réunion « ${p.roomLabel} » sur TerangaMeet.`,
    "",
    `Rejoindre la réunion : ${p.url}`,
    ...(p.customMessage ? ["", p.customMessage] : []),
    "",
    "—",
    "TerangaMeet · UN-CHK",
  ].join("\n");
}

function buildHtml(p: {
  inviter: string;
  url: string;
  roomLabel: string;
  customMessage?: string;
}): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const messageBlock = p.customMessage
    ? `<p style="margin:0 0 1rem;color:#374151;white-space:pre-wrap">${esc(p.customMessage)}</p>`
    : "";
  return `<!doctype html>
<html lang="fr"><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:0 auto;padding:2rem 1rem">
    <div style="background:#ffffff;border-radius:12px;padding:2rem;border:1px solid #e5e7eb">
      <h1 style="margin:0 0 1rem;font-size:1.25rem;color:#111827">Invitation à une réunion</h1>
      <p style="margin:0 0 1rem;color:#374151">
        <strong>${esc(p.inviter)}</strong> vous invite à rejoindre la réunion
        « <strong>${esc(p.roomLabel)}</strong> » sur TerangaMeet.
      </p>
      ${messageBlock}
      <p style="margin:1.5rem 0">
        <a href="${esc(p.url)}"
           style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:0.75rem 1.5rem;border-radius:8px;font-weight:600">
          Rejoindre la réunion
        </a>
      </p>
      <p style="margin:0 0 0.5rem;color:#6b7280;font-size:0.85rem">
        Ou copiez ce lien : <a href="${esc(p.url)}" style="color:#4f46e5">${esc(p.url)}</a>
      </p>
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:0.8rem;margin-top:1.5rem">TerangaMeet · UN-CHK</p>
  </div>
</body></html>`;
}
