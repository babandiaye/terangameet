import { Router } from "express";
import { z } from "zod";
import { roomService } from "../livekit/client";
import {
  authorizeModeration,
  isAdminOrOwner,
  resolveRoom,
  roleForIdentity,
  ROOM_ADMIN_ATTRIBUTE,
} from "../services/rooms";
import { logger } from "../lib/logger";

export const roomModerationRouter = Router();

/** POST /:roomId/toggle-hand/ — raise/lower own hand (LiveKit-token authed). */
roomModerationRouter.post("/:roomId/toggle-hand/", async (req, res) => {
  const lk = req.livekit;
  if (!lk?.identity)
    return res.status(401).json({ detail: "LiveKit token required." });
  const raised = !!req.body?.raised;
  const { livekitRoom } = await authorizeModeration(req.params.roomId, {
    userId: req.user?.id,
    livekitRoom: lk.room,
    livekitIsAdmin: lk.isAdmin,
  });
  try {
    await roomService.updateParticipant(livekitRoom, lk.identity, {
      attributes: { handRaisedAt: raised ? new Date().toISOString() : "" },
    });
    res.json({ status: "success" });
  } catch (err) {
    logger.error("[moderation] toggle-hand failed", err);
    res.status(502).json({ detail: "Unable to update hand state." });
  }
});

/** POST /:roomId/rename/ — rename own participant (LiveKit-token authed). */
roomModerationRouter.post("/:roomId/rename/", async (req, res) => {
  const lk = req.livekit;
  if (!lk?.identity)
    return res.status(401).json({ detail: "LiveKit token required." });
  // Authenticated participants carry their Keycloak name; only guests, who have
  // no account to be named by, may choose one.
  if (req.user) {
    return res.status(403).json({
      detail: "Votre nom provient de votre compte et ne peut pas être modifié.",
    });
  }
  const name = z.string().min(1).max(100).safeParse(req.body?.name);
  if (!name.success) return res.status(400).json({ detail: "Invalid name." });
  const { livekitRoom } = await authorizeModeration(req.params.roomId, {
    // Only guests reach this point, so there is no session user to authorize by.
    userId: undefined,
    livekitRoom: lk.room,
    livekitIsAdmin: lk.isAdmin,
  });
  try {
    await roomService.updateParticipant(livekitRoom, lk.identity, {
      name: name.data,
    });
    res.json({ status: "success" });
  } catch (err) {
    logger.error("[moderation] rename failed", err);
    res.status(502).json({ detail: "Unable to rename." });
  }
});

/** POST /:roomId/mute-participant/ — admin mutes a participant's track. */
roomModerationRouter.post("/:roomId/mute-participant/", async (req, res) => {
  const schema = z.object({
    participant_identity: z.string().min(1),
    track_sid: z.string().optional(),
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

  try {
    let trackSid = parsed.data.track_sid;
    if (!trackSid) {
      const participants = await roomService.listParticipants(auth.livekitRoom);
      const p = participants.find(
        (x) => x.identity === parsed.data.participant_identity,
      );
      trackSid = p?.tracks.find((t) => t.type === 0 /* AUDIO */)?.sid;
    }
    if (!trackSid)
      return res.json({ status: "success", detail: "No track to mute." });
    await roomService.mutePublishedTrack(
      auth.livekitRoom,
      parsed.data.participant_identity,
      trackSid,
      true,
    );
    res.json({ status: "success" });
  } catch (err) {
    logger.error("[moderation] mute failed", err);
    res.status(502).json({ detail: "Unable to mute participant." });
  }
});

/** POST /:roomId/remove-participant/ — admin removes a participant. */
roomModerationRouter.post("/:roomId/remove-participant/", async (req, res) => {
  const identity = z.string().min(1).safeParse(req.body?.participant_identity);
  if (!identity.success)
    return res.status(400).json({ detail: "Invalid participant_identity." });

  const auth = await authorizeModeration(req.params.roomId, {
    userId: req.user?.id,
    livekitRoom: req.livekit?.room,
    livekitIsAdmin: req.livekit?.isAdmin,
    livekitIdentity: req.livekit?.identity,
  });
  if (!auth.ok)
    return res.status(403).json({ detail: "Insufficient privileges." });

  try {
    await roomService.removeParticipant(auth.livekitRoom, identity.data);
    res.json({ status: "success" });
  } catch (err) {
    logger.error("[moderation] remove failed", err);
    res.status(502).json({ detail: "Unable to remove participant." });
  }
});

/** POST /:roomId/update-participant/ — admin updates permissions/metadata/name/attributes. */
roomModerationRouter.post("/:roomId/update-participant/", async (req, res) => {
  const schema = z.object({
    participant_identity: z.string().min(1),
    permission: z.record(z.any()).optional(),
    metadata: z.union([z.string(), z.record(z.any())]).optional(),
    attributes: z.record(z.string()).optional(),
    name: z.string().optional(),
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

  // Map snake_case permission keys to the LiveKit SDK's camelCase.
  const p = parsed.data.permission;
  const permission = p
    ? {
        canSubscribe: p.can_subscribe,
        canPublish: p.can_publish,
        canPublishData: p.can_publish_data,
        canUpdateMetadata: p.can_update_metadata,
        canPublishSources: p.can_publish_sources,
      }
    : undefined;

  try {
    await roomService.updateParticipant(
      auth.livekitRoom,
      parsed.data.participant_identity,
      {
        ...(permission ? { permission: permission as never } : {}),
        ...(parsed.data.metadata
          ? {
              metadata:
                typeof parsed.data.metadata === "string"
                  ? parsed.data.metadata
                  : JSON.stringify(parsed.data.metadata),
            }
          : {}),
        ...(parsed.data.attributes
          ? { attributes: parsed.data.attributes }
          : {}),
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
      },
    );
    res.json({ status: "success" });
  } catch (err) {
    logger.error("[moderation] update-participant failed", err);
    res.status(502).json({ detail: "Unable to update participant." });
  }
});

/**
 * POST /:roomId/promote-participant/ — grant or revoke co-host for this session.
 *
 * Deliberately not persisted: the standing lives in the participant's LiveKit
 * attributes, so it reaches every client immediately (ParticipantAttributesChanged)
 * and is gone when the room ends. Nothing to clean up, and no lingering rights on
 * a room somebody was once helped with.
 */
roomModerationRouter.post("/:roomId/promote-participant/", async (req, res) => {
  const schema = z.object({
    participant_identity: z.string().min(1),
    co_host: z.boolean(),
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

  const { participant_identity: identity, co_host: coHost } = parsed.data;

  // A co-host must not be able to strip the owner, who would otherwise lose
  // control of their own room to someone they just helped.
  if (!coHost) {
    const { room } = await resolveRoom(req.params.roomId);
    if (room && isAdminOrOwner(await roleForIdentity(room.id, identity))) {
      return res.status(409).json({
        detail: "Le propriétaire de la salle ne peut pas être rétrogradé.",
      });
    }
  }

  try {
    await roomService.updateParticipant(auth.livekitRoom, identity, {
      attributes: { [ROOM_ADMIN_ATTRIBUTE]: coHost ? "true" : "false" },
    });
    res.json({ status: "success" });
  } catch (err) {
    logger.error("[moderation] co-host update failed", err);
    res.status(502).json({ detail: "Unable to update participant." });
  }
});

/**
 * POST /:roomId/end/ — end the meeting for everyone.
 *
 * Deleting the LiveKit room disconnects every participant and makes LiveKit emit
 * room_finished, which the webhook already turns into a closed MeetingSession —
 * so the history and the durations stay correct without any extra bookkeeping.
 */
roomModerationRouter.post("/:roomId/end/", async (req, res) => {
  const auth = await authorizeModeration(req.params.roomId, {
    userId: req.user?.id,
    livekitRoom: req.livekit?.room,
    livekitIsAdmin: req.livekit?.isAdmin,
    livekitIdentity: req.livekit?.identity,
  });
  if (!auth.ok)
    return res.status(403).json({ detail: "Insufficient privileges." });

  try {
    await roomService.deleteRoom(auth.livekitRoom);
    res.json({ status: "success" });
  } catch (err) {
    logger.error("[moderation] ending the room failed", err);
    res.status(502).json({ detail: "Unable to end the meeting." });
  }
});
