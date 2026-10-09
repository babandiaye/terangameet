import { Router, type Request } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { redis } from "../lib/redis";
import { splitWaiting, type LobbyEntry } from "../lib/lobbyEntries";
import { env } from "../config/env";
import { generateLiveKitToken } from "../livekit/token";
import { participantDisplayName } from "../lib/participantName";
import { notifyRoom } from "../livekit/notify";
import { colorFromSeed } from "../utils/color";
import { entryDecision } from "../lib/roomAccess";
import {
  resolveRoom,
  authorizeModeration,
  getRole,
  isAdminOrOwner,
  publishableSources,
  type RoomConfiguration,
} from "../services/rooms";

export const lobbyRouter = Router();


const key = (room: string) => `${env.lobby.keyPrefix}:${room}`;

async function getEntry(room: string, id: string): Promise<LobbyEntry | null> {
  const raw = await redis.hget(key(room), id);
  return raw ? (JSON.parse(raw) as LobbyEntry) : null;
}
async function setEntry(room: string, entry: LobbyEntry): Promise<void> {
  await redis.hset(key(room), entry.id, JSON.stringify(entry));
  await redis.expire(key(room), env.lobby.acceptedTimeout);
}

/** Local shim so call sites keep reading `displayName(req, username)`. */
function displayName(req: Request, username?: string): string {
  return participantDisplayName(req.user, username);
}

/** POST /:roomId/request-entry/ — guest asks to join a restricted room (polled). */
lobbyRouter.post("/:roomId/request-entry/", async (req, res) => {
  const username =
    z.string().max(100).optional().parse(req.body?.username) ?? "";
  const { room, livekitRoom } = await resolveRoom(req.params.roomId);

  // Unregistered room: only when ad-hoc rooms are allowed. This used to hand
  // out a token for any name at all, even with ALLOW_UNREGISTERED_ROOMS=false.
  if (!room) {
    if (!env.rooms.allowUnregistered) {
      return res.status(404).json({ detail: "Room not found." });
    }
    const token = await generateLiveKitToken({
      room: livekitRoom,
      identity: ownIdentity(req),
      name: displayName(req, username),
      sources: publishableSources(undefined),
    });
    return res.json({
      status: "accepted",
      livekit: { url: env.livekit.wsUrl, room: livekitRoom, token },
    });
  }

  // Same rule as GET /rooms/:id (lib/roomAccess). Before, only restricted
  // rooms went through the lobby, so a guest of a trusted room got straight in.
  const role = await getRole(room.id, req.user?.id);
  const admin = isAdminOrOwner(role);
  const decision = entryDecision({
    accessLevel: room.accessLevel,
    isAuthenticated: !!req.user,
    role,
  });
  if (decision === "direct") {
    const token = await generateLiveKitToken({
      room: livekitRoom,
      identity: ownIdentity(req),
      name: displayName(req, username),
      sources: publishableSources(
        room.configuration as RoomConfiguration,
        admin,
      ),
      isAdminOrOwner: admin,
    });
    return res.json({
      status: "accepted",
      livekit: { url: env.livekit.wsUrl, room: livekitRoom, token },
    });
  }

  // Stable per-session lobby participant id.
  req.session.lobby ??= {};
  let pid = req.session.lobby[livekitRoom];
  if (!pid) {
    pid = randomUUID();
    req.session.lobby[livekitRoom] = pid;
  }

  const existing = await getEntry(livekitRoom, pid);

  if (existing?.status === "accepted") {
    const token = await generateLiveKitToken({
      room: livekitRoom,
      // A signed-in person admitted from the lobby keeps their own identity:
      // as guest-… the session would be missing from their history and its
      // recordings out of their reach.
      identity: req.user ? ownIdentity(req) : `guest-${pid}`,
      name: existing.username,
      color: existing.color,
      sources: publishableSources(room.configuration as RoomConfiguration),
    });
    await redis.hdel(key(livekitRoom), pid);
    return res.json({
      status: "accepted",
      livekit: { url: env.livekit.wsUrl, room: livekitRoom, token },
    });
  }

  if (existing?.status === "denied") {
    await redis.hdel(key(livekitRoom), pid);
    return res.json({ status: "denied" });
  }

  // New or still waiting.
  const entry: LobbyEntry = existing ?? {
    id: pid,
    username: displayName(req, username),
    color: colorFromSeed(pid),
    status: "waiting",
    createdAt: Date.now(),
  };
  entry.username = displayName(req, username);
  entry.lastSeenAt = Date.now(); // the browser is still waiting
  await setEntry(livekitRoom, entry);

  if (!existing) {
    // Nudge admins to refresh their waiting list.
    await notifyRoom(livekitRoom, { type: "participantWaiting" });
  }
  res.json({ status: "waiting" });
});

/** GET /:roomId/waiting-participants/ — admins list waiting guests. */
lobbyRouter.get("/:roomId/waiting-participants/", async (req, res) => {
  const auth = await authorizeModeration(req.params.roomId, {
    userId: req.user?.id,
    livekitRoom: req.livekit?.room,
    livekitIsAdmin: req.livekit?.isAdmin,
    livekitIdentity: req.livekit?.identity,
  });
  if (!auth.ok)
    return res.status(403).json({ detail: "Insufficient privileges." });

  const all = await redis.hgetall(key(auth.livekitRoom));
  const { waiting, stale } = splitWaiting(
    Object.values(all).map((raw) => JSON.parse(raw) as LobbyEntry),
    Date.now(),
  );
  // Requests whose browser stopped asking (tab closed) are dropped.
  if (stale.length) await redis.hdel(key(auth.livekitRoom), ...stale);
  const participants = waiting
    .map((e) => ({
      id: e.id,
      status: e.status,
      username: e.username,
      color: e.color,
    }));
  res.json({ participants });
});

/** POST /:roomId/enter/ — admin accepts or denies a waiting guest. */
lobbyRouter.post("/:roomId/enter/", async (req, res) => {
  const schema = z.object({
    participant_id: z.string().min(1),
    allow_entry: z.boolean(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ detail: "Invalid payload." });

  const auth = await authorizeModeration(req.params.roomId, {
    userId: req.user?.id,
    livekitRoom: req.livekit?.room,
    livekitIsAdmin: req.livekit?.isAdmin,
    livekitIdentity: req.livekit?.identity,
  });
  if (!auth.ok)
    return res.status(403).json({ detail: "Insufficient privileges." });

  const entry = await getEntry(auth.livekitRoom, parsed.data.participant_id);
  if (!entry) return res.status(404).json({ detail: "Participant not found." });

  entry.status = parsed.data.allow_entry ? "accepted" : "denied";
  await setEntry(auth.livekitRoom, entry);
  res.json({ message: parsed.data.allow_entry ? "accepted" : "denied" });
});

/** The caller's LiveKit identity, as GET /rooms/:id derives it. */
function ownIdentity(req: Request): string {
  if (req.user) return req.user.sub || req.user.id;
  if (!req.session.anonId) req.session.anonId = randomUUID();
  return `anon-${req.session.anonId}`;
}
