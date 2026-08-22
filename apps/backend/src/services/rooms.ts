import type { Room, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { isUuid } from "../utils/slug";
import { roomService } from "../livekit/client";

/** Resolve a room by id or slug. Returns the record (or null) plus the LiveKit room name. */
export async function resolveRoom(
  roomId: string,
): Promise<{ room: Room | null; livekitRoom: string }> {
  const room = await prisma.room.findFirst({
    where: isUuid(roomId)
      ? { OR: [{ id: roomId }, { slug: roomId }] }
      : { slug: roomId },
  });
  return { room, livekitRoom: room?.id ?? roomId };
}

/** Attribute carrying the moderator flag, readable by every client in the room. */
export const ROOM_ADMIN_ATTRIBUTE = "room_admin";

/**
 * Is this participant a co-host for the current session?
 *
 * The promotion is deliberately not persisted: it lives in the participant's
 * LiveKit attributes and disappears with the room. Only the server can write
 * them — tokens are issued with canUpdateOwnMetadata: false — so a participant
 * cannot promote themselves.
 */
export async function isSessionCoHost(
  livekitRoom: string,
  identity: string,
): Promise<boolean> {
  try {
    const participant = await roomService.getParticipant(livekitRoom, identity);
    return participant.attributes?.[ROOM_ADMIN_ATTRIBUTE] === "true";
  } catch {
    // Not in the room (or it is gone): no standing.
    return false;
  }
}

/**
 * Decide whether the caller may moderate the given room, from any of three
 * standings: an admin grant in their LiveKit token, a persisted room role, or a
 * co-host promotion held for the duration of this session.
 */
export async function authorizeModeration(
  roomId: string,
  opts: {
    userId?: string | null;
    livekitRoom?: string;
    livekitIsAdmin?: boolean;
    livekitIdentity?: string;
  },
): Promise<{ ok: boolean; livekitRoom: string; isAdmin: boolean }> {
  const { room, livekitRoom } = await resolveRoom(roomId);

  // Ad-hoc (unregistered) room: everyone is effectively an admin.
  if (!room) {
    return { ok: env.rooms.allowUnregistered, livekitRoom, isAdmin: true };
  }

  // LiveKit token scoped to this room with admin grant.
  if (opts.livekitRoom === livekitRoom && opts.livekitIsAdmin) {
    return { ok: true, livekitRoom, isAdmin: true };
  }

  const role = await getRole(room.id, opts.userId);
  if (isAdminOrOwner(role)) return { ok: true, livekitRoom, isAdmin: true };

  // Last, because it costs a call to LiveKit: owners never reach this line.
  if (opts.livekitRoom === livekitRoom && opts.livekitIdentity) {
    if (await isSessionCoHost(livekitRoom, opts.livekitIdentity)) {
      return { ok: true, livekitRoom, isAdmin: true };
    }
  }

  return { ok: false, livekitRoom, isAdmin: false };
}

/**
 * The persisted role behind a LiveKit identity, which is the user's `sub` when
 * they have an account and `anon-…`/`guest-…` otherwise. Used to protect the
 * owner from being demoted by someone they promoted.
 */
export async function roleForIdentity(
  roomId: string,
  identity: string,
): Promise<Role | null> {
  const user = await prisma.user.findFirst({
    where: { OR: [{ sub: identity }, { id: identity }] },
    select: { id: true },
  });
  if (!user) return null;
  return getRole(roomId, user.id);
}

export interface RoomConfiguration {
  can_publish_sources?: string[] | null;
  everyone_can_mute?: boolean | null;
}

/** Returns the user's role on a room, or null. */
export async function getRole(
  roomId: string,
  userId?: string | null,
): Promise<Role | null> {
  if (!userId) return null;
  const access = await prisma.roomAccess.findUnique({
    where: { userId_roomId: { userId, roomId } },
  });
  return access?.role ?? null;
}

export function isAdminOrOwner(role: Role | null): boolean {
  return role === "ADMIN" || role === "OWNER";
}

/** LiveKit room name used on the wire: registered rooms use their UUID, ad-hoc rooms their slug. */
export function liveKitRoomName(
  room: { id: string; slug: string | null } | { slug: string },
): string {
  return "id" in room ? room.id : room.slug;
}

export interface SerializeOpts {
  isAdministrable: boolean;
  livekit?: { url: string; room: string; token: string };
}

export function serializeRoom(
  room: Pick<
    Room,
    "id" | "name" | "slug" | "accessLevel" | "configuration" | "pinCode"
  >,
  opts: SerializeOpts,
) {
  const configuration = (room.configuration ?? {}) as RoomConfiguration;
  return {
    id: room.id,
    name: room.name,
    slug: room.slug ?? room.id,
    pin_code: room.pinCode ?? "",
    is_administrable: opts.isAdministrable,
    access_level: String(room.accessLevel).toLowerCase(),
    configuration,
    ...(opts.livekit ? { livekit: opts.livekit } : {}),
  };
}

/** A synthetic, non-persisted room (joining an unregistered room by name). */
export function serializeEphemeralRoom(slug: string, opts: SerializeOpts) {
  return {
    id: slug,
    name: slug,
    slug,
    pin_code: "",
    is_administrable: opts.isAdministrable,
    access_level: env.rooms.defaultAccessLevel,
    configuration: {} as RoomConfiguration,
    ...(opts.livekit ? { livekit: opts.livekit } : {}),
  };
}

/**
 * Which sources a participant may publish, for a given room config.
 *
 * The moderation switches limit contributors, not moderators: the in-session
 * permission update already skips admins, so a moderator who reloads after
 * turning off microphones must not come back without their own.
 *
 * An explicit empty list means "nothing may be published" and is honoured as
 * such; only a missing key means "never configured". Treating [] as unset made
 * turning everything off silently restore the defaults on the next join.
 */
export function publishableSources(
  config: RoomConfiguration | null | undefined,
  isAdminOrOwner = false,
): string[] {
  if (isAdminOrOwner) return env.livekit.defaultSources;
  const sources = config?.can_publish_sources;
  if (Array.isArray(sources)) return sources;
  return env.livekit.defaultSources;
}
