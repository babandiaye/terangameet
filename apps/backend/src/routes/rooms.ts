import { Router, type Request } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { requireAuth, requireStaff } from "../auth/middleware";
import { generateLiveKitToken } from "../livekit/token";
import { notifyRoom } from "../livekit/notify";
import { participantDisplayName } from "../lib/participantName";
import { slugify, isUuid } from "../utils/slug";
import { entryDecision } from "../lib/roomAccess";
import { deleteObject } from "../lib/s3";
import { recordingObjectKey } from "../lib/recordingKey";
import {
  getRole,
  isAdminOrOwner,
  serializeRoom,
  serializeEphemeralRoom,
  publishableSources,
  type RoomConfiguration,
} from "../services/rooms";

export const roomsRouter = Router();

/** Stable participant identity: OIDC sub for users, a per-session id for guests. */
function participantIdentity(req: Request): string {
  if (req.user) return req.user.sub || req.user.id;
  if (!req.session.anonId) req.session.anonId = randomUUID();
  return `anon-${req.session.anonId}`;
}

/** Local shim so call sites keep reading `displayName(req, username)`. */
function displayName(req: Request, username?: string): string {
  return participantDisplayName(req.user, username);
}

const CALLBACK_PREFIX = "room_creation_callback:";

/** Longest meeting title accepted, on creation as on rename. */
const ROOM_NAME_MAX = 120;
/** Lowercase words joined by single dashes: the shape of every room link. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** POST /api/v1.0/rooms/creation-callback/ — retrieve a cached room creation result. */
roomsRouter.post("/creation-callback/", async (req, res) => {
  const callbackId = String(req.body?.callback_id ?? "");
  if (!callbackId)
    return res.status(400).json({ detail: "callback_id est requis." });
  const raw = await redis.get(CALLBACK_PREFIX + callbackId);
  if (!raw) return res.status(404).json({ status: "pending" });
  res.json({ status: "success", room: JSON.parse(raw) });
});

/** POST /api/v1.0/rooms/?username= — create a persistent room (auth required). */
roomsRouter.post("/", requireAuth, async (req, res) => {
  const schema = z.object({
    // Human-readable title ("Commission des marchés – ouverture des plis").
    name: z.string().trim().min(1).max(ROOM_NAME_MAX),
    // The link, chosen by the client (e.g. "ryf-lqxd-dtu") so the title stays
    // free text. Omitted by older callers, which still derive it from the name.
    slug: z.string().max(100).regex(SLUG_RE).optional(),
    callback_id: z.string().optional(),
    access_level: z.enum(["public", "public_lobby", "trusted", "restricted"]).optional(),
    configuration: z.record(z.any()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ detail: "Requête invalide.", errors: parsed.error.flatten() });
  }
  const { name, callback_id, access_level, configuration } = parsed.data;
  const username = req.query.username as string | undefined;

  const slug =
    parsed.data.slug || slugify(name) || randomUUID().slice(0, 8);

  // Reuse an existing room with the same slug owned by anyone, else create.
  // Two concurrent creates can both see "no room"; the unique slug constraint
  // makes the loser fail with P2002 — we then just re-fetch the winner's room.
  let room = await prisma.room.findUnique({ where: { slug } });
  if (!room) {
    try {
      room = await prisma.room.create({
        data: {
          name,
          slug,
          accessLevel:
            (access_level?.toUpperCase() as never) ??
            (env.rooms.defaultAccessLevel.toUpperCase() as never),
          configuration: (configuration ?? {}) as object,
          accesses: { create: { userId: req.user!.id, role: "OWNER" } },
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        room = await prisma.room.findUnique({ where: { slug } });
      }
      if (!room) throw err;
    }
  }

  const role = await getRole(room.id, req.user!.id);
  const admin = isAdminOrOwner(role);
  const token = await generateLiveKitToken({
    room: room.id,
    identity: participantIdentity(req),
    name: displayName(req, username),
    sources: publishableSources(room.configuration as RoomConfiguration, admin),
    isAdminOrOwner: admin,
  });

  const payload = serializeRoom(room, {
    isAdministrable: admin,
    livekit: { url: env.livekit.wsUrl, room: room.id, token },
  });

  if (callback_id) {
    await redis.set(
      CALLBACK_PREFIX + callback_id,
      JSON.stringify(payload),
      "EX",
      600,
    );
  }

  res.status(201).json(payload);
});

/** GET /api/v1.0/rooms/:roomId?username= — join/get a room (+ LiveKit token). */
roomsRouter.get("/:roomId", async (req, res) => {
  const roomId = req.params.roomId;
  const username = req.query.username as string | undefined;

  const room = await prisma.room.findFirst({
    where: isUuid(roomId)
      ? { OR: [{ id: roomId }, { slug: roomId }] }
      : { slug: roomId },
  });

  // Unregistered room: allow ad-hoc joining if enabled.
  if (!room) {
    if (!env.rooms.allowUnregistered) {
      return res.status(404).json({ detail: "Salle introuvable." });
    }
    const token = await generateLiveKitToken({
      room: roomId,
      identity: participantIdentity(req),
      name: displayName(req, username),
      sources: env.livekit.defaultSources,
      isAdminOrOwner: true, // no owner exists for ad-hoc rooms
    });
    return res.json(
      serializeEphemeralRoom(roomId, {
        isAdministrable: true,
        livekit: { url: env.livekit.wsUrl, room: roomId, token },
      }),
    );
  }

  const role = await getRole(room.id, req.user?.id);
  const admin = isAdminOrOwner(role);

  // Access control. No token means "not yet": the join screen sends people
  // who must sign in to SENID first (from the access level), and the others
  // through the lobby. request-entry enforces the same rule, so going around
  // the join screen gets no one in.
  const decision = entryDecision({
    accessLevel: room.accessLevel,
    isAuthenticated: !!req.user,
    role,
  });
  if (decision !== "direct") {
    return res.json(serializeRoom(room, { isAdministrable: false }));
  }

  const token = await generateLiveKitToken({
    room: room.id,
    identity: participantIdentity(req),
    name: displayName(req, username),
    sources: publishableSources(room.configuration as RoomConfiguration, admin),
    isAdminOrOwner: admin,
  });

  res.json(
    serializeRoom(room, {
      isAdministrable: admin,
      livekit: { url: env.livekit.wsUrl, room: room.id, token },
    }),
  );
});

/** PATCH /api/v1.0/rooms/:roomId — update room (admins/owners). */
roomsRouter.patch("/:roomId", requireAuth, async (req, res) => {
  const room = await prisma.room.findFirst({
    where: isUuid(req.params.roomId)
      ? { id: req.params.roomId }
      : { slug: req.params.roomId },
  });
  if (!room) return res.status(404).json({ detail: "Salle introuvable." });
  const role = await getRole(room.id, req.user!.id);
  // Platform administrators may edit any room (from the admin console).
  if (!isAdminOrOwner(role) && !req.user!.isStaff)
    return res.status(403).json({ detail: "Vous n’avez pas les droits nécessaires pour cette action." });

  const schema = z.object({
    name: z.string().trim().min(1).max(ROOM_NAME_MAX).optional(),
    access_level: z.enum(["public", "public_lobby", "trusted", "restricted"]).optional(),
    configuration: z.record(z.any()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ detail: "Requête invalide." });

  const updated = await prisma.room.update({
    where: { id: room.id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.access_level
        ? { accessLevel: parsed.data.access_level.toUpperCase() as never }
        : {}),
      ...(parsed.data.configuration
        ? { configuration: parsed.data.configuration as object }
        : {}),
    },
  });
  // A meeting renamed while it runs keeps that name in the history: the
  // session's title is a snapshot taken at room_started, so refresh it.
  if (parsed.data.name) {
    await prisma.meetingSession.updateMany({
      where: { roomId: room.id, endedAt: null },
      data: { title: parsed.data.name },
    });
    // Everyone in the call shows the title; tell them it changed.
    await notifyRoom(room.id, {
      type: "roomRenamed",
      data: { name: updated.name },
    });
  }
  res.json(serializeRoom(updated, { isAdministrable: true }));
});

/**
 * DELETE /api/v1.0/rooms/:roomId — platform administrators only.
 *
 * Deliberately not the owner: a deleted link stops working for everyone who
 * was given it, so the decision sits with the administrators.
 *
 * The session history survives (its room reference is set to null), but the
 * recordings cascade with the room: their files are removed from storage
 * first, so nothing is left orphaned in the bucket. Refused while a recording
 * is running — the egress would be writing to a room that no longer exists.
 */
roomsRouter.delete("/:roomId", requireStaff, async (req, res) => {
  const room = await prisma.room.findFirst({
    where: isUuid(req.params.roomId)
      ? { id: req.params.roomId }
      : { slug: req.params.roomId },
    include: { recordings: { select: { id: true, mode: true, status: true } } },
  });
  if (!room) return res.status(404).json({ detail: "Salle introuvable." });
  if (room.recordings.some((r) => ["INITIATED", "ACTIVE"].includes(r.status))) {
    return res.status(409).json({
      detail: "Un enregistrement est en cours dans cette salle : arrêtez-le d'abord.",
    });
  }
  for (const r of room.recordings) {
    await deleteObject(recordingObjectKey(r), env.recording.bucket).catch((err) =>
      logger.warn(`[rooms] recording file delete failed for ${r.id}`, err),
    );
  }
  await prisma.room.delete({ where: { id: room.id } });
  logger.info(`[rooms] deleted ${room.id}`);
  res.status(204).send();
});
