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
import { entryDecision, LOGIN_REQUIRED } from "../lib/roomAccess";
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
/**
 * The waiting browser asks every second while a moderator may decide at any
 * moment: both sides change one entry, so each change is a single Lua script,
 * atomic in Redis. Before, the guest's read-then-write could put « waiting »
 * back over an acceptance made in between, and the moderator had to admit
 * them twice.
 */
const TOUCH_SCRIPT = `
local raw = redis.call('HGET', KEYS[1], ARGV[1])
local e
if raw then e = cjson.decode(raw) else e = cjson.decode(ARGV[4]) end
e.username = ARGV[2]
e.lastSeenAt = tonumber(ARGV[3])
redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(e))
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[5]))
if raw then return 1 else return 0 end`;

const DECIDE_SCRIPT = `
local raw = redis.call('HGET', KEYS[1], ARGV[1])
if not raw then return 0 end
local e = cjson.decode(raw)
e.status = ARGV[2]
e.decidedAt = tonumber(ARGV[3])
redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(e))
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[4]))
return 1`;

/** Record that the guest is still asking (creating the request if new); status untouched. Returns true if it existed. */
async function touchEntry(room: string, fresh: LobbyEntry): Promise<boolean> {
  const existed = await redis.eval(
    TOUCH_SCRIPT,
    1,
    key(room),
    fresh.id,
    fresh.username,
    String(Date.now()),
    JSON.stringify(fresh),
    String(env.lobby.acceptedTimeout),
  );
  return existed === 1;
}

/** A moderator's decision; false if the request is gone. */
async function decide(room: string, id: string, status: "accepted" | "denied"): Promise<boolean> {
  const done = await redis.eval(
    DECIDE_SCRIPT,
    1,
    key(room),
    id,
    status,
    String(Date.now()),
    String(env.lobby.acceptedTimeout),
  );
  return done === 1;
}

/** Local shim so call sites keep reading `displayName(req, username)`. */
function displayName(req: Request, username?: string): string {
  return participantDisplayName(req.user, username);
}

/** POST /:roomId/request-entry/ — asks to join a room that has a lobby (polled). */
lobbyRouter.post("/:roomId/request-entry/", async (req, res) => {
  const username =
    z.string().max(100).optional().parse(req.body?.username) ?? "";
  const { room, livekitRoom } = await resolveRoom(req.params.roomId);

  // Unregistered room: only when ad-hoc rooms are allowed. This used to hand
  // out a token for any name at all, even with ALLOW_UNREGISTERED_ROOMS=false.
  if (!room) {
    if (!env.rooms.allowUnregistered) {
      return res.status(404).json({ detail: "Salle introuvable." });
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

  // Same rule as GET /rooms/:id (lib/roomAccess). A guest of a trusted or
  // restricted room cannot even wait: SENID sign-in comes first.
  const role = await getRole(room.id, req.user?.id);
  const admin = isAdminOrOwner(role);
  const decision = entryDecision({
    accessLevel: room.accessLevel,
    isAuthenticated: !!req.user,
    role,
  });
  if (decision === "login") return res.status(401).json(LOGIN_REQUIRED);
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

  // A refusal holds for a few minutes: asking again at once used to put the
  // person straight back in the moderators' list.
  if (existing?.status === "denied") {
    const since = Date.now() - (existing.decidedAt ?? 0);
    if (since < env.lobby.deniedTimeout * 60_000) return res.json({ status: "denied" });
    await redis.hdel(key(livekitRoom), pid);
  }

  // New or still waiting: only the name and « still asking » change.
  const existed = await touchEntry(livekitRoom, {
    id: pid,
    username: displayName(req, username),
    color: colorFromSeed(pid),
    status: "waiting",
    createdAt: Date.now(),
    lastSeenAt: Date.now(),
  });

  if (!existed) {
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
    return res.status(403).json({ detail: "Vous n’avez pas les droits nécessaires pour cette action." });

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
    return res.status(400).json({ detail: "Requête invalide." });

  const auth = await authorizeModeration(req.params.roomId, {
    userId: req.user?.id,
    livekitRoom: req.livekit?.room,
    livekitIsAdmin: req.livekit?.isAdmin,
    livekitIdentity: req.livekit?.identity,
  });
  if (!auth.ok)
    return res.status(403).json({ detail: "Vous n’avez pas les droits nécessaires pour cette action." });

  const found = await decide(
    auth.livekitRoom,
    parsed.data.participant_id,
    parsed.data.allow_entry ? "accepted" : "denied",
  );
  if (!found) return res.status(404).json({ detail: "Participant introuvable." });
  res.json({ message: parsed.data.allow_entry ? "accepted" : "denied" });
});

/** The caller's LiveKit identity, as GET /rooms/:id derives it. */
function ownIdentity(req: Request): string {
  if (req.user) return req.user.sub || req.user.id;
  if (!req.session.anonId) req.session.anonId = randomUUID();
  return `anon-${req.session.anonId}`;
}
