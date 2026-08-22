import { Router } from "express";
import { z } from "zod";
import {
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from "livekit-server-sdk";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { logger } from "../lib/logger";
import { egressClient, roomService } from "../livekit/client";
import { notifyRoom } from "../livekit/notify";
import { s3Configured, getObjectStream, deleteObject } from "../lib/s3";
import { recordingStatusToApi } from "../lib/recordingStatus";
import { paging, paginated } from "../lib/pagination";
import { requireAuth } from "../auth/middleware";
import {
  resolveRoom,
  authorizeModeration,
  serializeRoom,
} from "../services/rooms";
import { currentSessionId } from "../services/meetingSessions";
import { readableRecordingsWhere } from "../services/userSpace";

/** Room-scoped recording/subtitle actions, mounted under /api/v1.0/rooms. */
export const recordingRoomRouter = Router();

function s3Output(recordingId: string, mode: string): EncodedFileOutput {
  const isTranscript = mode === "transcript";
  return new EncodedFileOutput({
    fileType: isTranscript ? EncodedFileType.OGG : EncodedFileType.MP4,
    filepath: `${env.recording.outputFolder}/${recordingId}.${isTranscript ? "ogg" : "mp4"}`,
    output: {
      case: "s3",
      value: new S3Upload({
        accessKey: env.storage.accessKeyId,
        secret: env.storage.secretAccessKey,
        region: env.storage.region,
        endpoint: env.storage.endpoint || undefined,
        bucket: env.recording.bucket,
        forcePathStyle: env.storage.forcePathStyle,
      }),
    },
  });
}

async function authzAdmin(req: import("express").Request, roomId: string) {
  return authorizeModeration(roomId, {
    userId: req.user?.id,
    livekitRoom: req.livekit?.room,
    livekitIsAdmin: req.livekit?.isAdmin,
    livekitIdentity: req.livekit?.identity,
  });
}

/** POST /:roomId/start-recording/ */
recordingRoomRouter.post("/:roomId/start-recording/", async (req, res) => {
  if (!env.recording.enabled || !s3Configured()) {
    return res.status(403).json({ detail: "Recording is disabled." });
  }
  const schema = z.object({
    mode: z
      .enum(["screen_recording", "transcript"])
      .default("screen_recording"),
    options: z.record(z.any()).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ detail: "Invalid payload." });

  const { room, livekitRoom } = await resolveRoom(req.params.roomId);
  if (!room)
    return res
      .status(400)
      .json({ detail: "Recording requires a registered room." });

  const auth = await authzAdmin(req, req.params.roomId);
  if (!auth.ok)
    return res.status(403).json({ detail: "Insufficient privileges." });

  // One active recording per room. The findFirst handles the common case; the
  // partial unique index (recordings_one_active_per_room) closes the race when
  // two admins start simultaneously — the loser gets P2002 → 409.
  const active = await prisma.recording.findFirst({
    where: { roomId: room.id, status: { in: ["INITIATED", "ACTIVE"] } },
  });
  if (active)
    return res
      .status(409)
      .json({ detail: "A recording is already in progress." });

  const mode =
    parsed.data.mode === "transcript" ? "TRANSCRIPT" : "SCREEN_RECORDING";
  // Tie the recording to the meeting occurrence it captures, so its participants
  // can find it later in their personal space.
  const sessionId = await currentSessionId(livekitRoom);
  let recording;
  try {
    recording = await prisma.recording.create({
      data: {
        roomId: room.id,
        sessionId,
        mode: mode as never,
        status: "INITIATED",
        options: (parsed.data.options ?? {}) as object,
        creatorId: req.user?.id ?? null,
        accesses: { create: { userId: req.user?.id ?? null, role: "OWNER" } },
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return res
        .status(409)
        .json({ detail: "A recording is already in progress." });
    }
    throw err;
  }

  try {
    const info = await egressClient.startRoomCompositeEgress(
      livekitRoom,
      s3Output(recording.id, parsed.data.mode),
      { layout: "speaker", audioOnly: parsed.data.mode === "transcript" },
    );
    await prisma.recording.update({
      where: { id: recording.id },
      data: { workerId: info.egressId, status: "ACTIVE" },
    });
    // The frontend reads recording state from room metadata and expects the
    // vocabulary { starting | started | saving }. 'started' + LiveKit's own
    // isRecording flag drives the "starting → recording" indicator.
    await roomService
      .updateRoomMetadata(
        livekitRoom,
        JSON.stringify({
          recording_status: "started",
          recording_mode: parsed.data.mode,
        }),
      )
      .catch((e) =>
        logger.warn(
          `[recording] metadata update (start) failed: ${(e as Error).message}`,
        ),
      );
    await notifyRoom(livekitRoom, { type: "screenRecordingStarted" });
  } catch (err) {
    await prisma.recording.update({
      where: { id: recording.id },
      data: { status: "FAILED_TO_START" },
    });
    logger.error("[recording] start failed", err);
    return res.status(502).json({ detail: "Unable to start recording." });
  }

  res.status(201).json(serializeRoom(room, { isAdministrable: true }));
});

/** POST /:roomId/stop-recording/ */
recordingRoomRouter.post("/:roomId/stop-recording/", async (req, res) => {
  const { room, livekitRoom } = await resolveRoom(req.params.roomId);
  if (!room) return res.status(404).json({ detail: "Room not found." });
  const auth = await authzAdmin(req, req.params.roomId);
  if (!auth.ok)
    return res.status(403).json({ detail: "Insufficient privileges." });

  const active = await prisma.recording.findFirst({
    where: { roomId: room.id, status: { in: ["INITIATED", "ACTIVE"] } },
  });
  if (!active) return res.status(404).json({ detail: "No active recording." });

  try {
    if (active.workerId) await egressClient.stopEgress(active.workerId);
    await prisma.recording.update({
      where: { id: active.id },
      data: { status: "STOPPED" },
    });
    // 'saving' keeps the indicator up while the egress finalizes & uploads; the
    // egress_ended webhook clears the metadata once the file is saved.
    const modeStr =
      active.mode === "TRANSCRIPT" ? "transcript" : "screen_recording";
    await roomService
      .updateRoomMetadata(
        livekitRoom,
        JSON.stringify({ recording_status: "saving", recording_mode: modeStr }),
      )
      .catch((e) =>
        logger.warn(
          `[recording] metadata update (stop) failed: ${(e as Error).message}`,
        ),
      );
    await notifyRoom(livekitRoom, { type: "screenRecordingStopped" });
  } catch (err) {
    logger.error("[recording] stop failed", err);
    return res.status(502).json({ detail: "Unable to stop recording." });
  }
  res.json(serializeRoom(room, { isAdministrable: true }));
});

/** POST /:roomId/start-subtitle/ — start live transcription (agent dispatch). */
recordingRoomRouter.post("/:roomId/start-subtitle/", async (req, res) => {
  if (!env.subtitle.enabled)
    return res.status(403).json({ detail: "Subtitles are disabled." });
  const { room, livekitRoom } = await resolveRoom(req.params.roomId);
  const auth = await authzAdmin(req, req.params.roomId);
  if (!auth.ok)
    return res.status(403).json({ detail: "Insufficient privileges." });
  // Agent dispatch is handled by the LiveKit transcription agent listening on the room.
  await notifyRoom(livekitRoom, { type: "transcriptionStarted" });
  if (room) return res.json(serializeRoom(room, { isAdministrable: true }));
  res.json({ status: "success" });
});

/** Recordings collection, mounted under /api/v1.0/recordings. */
export const recordingsRouter = Router();
recordingsRouter.use(requireAuth);

function serializeRecording(r: import("@prisma/client").Recording) {
  const expiredAt = env.recording.expirationDays
    ? new Date(r.createdAt.getTime() + env.recording.expirationDays * 86400000)
    : null;
  return {
    id: r.id,
    room: r.roomId,
    created_at: r.createdAt.toISOString(),
    status: recordingStatusToApi(r.status),
    mode: r.mode.toLowerCase(),
    key: `${env.recording.outputFolder}/${r.id}.${r.mode === "TRANSCRIPT" ? "ogg" : "mp4"}`,
    expired_at: expiredAt?.toISOString() ?? null,
    is_expired: expiredAt ? expiredAt.getTime() < Date.now() : false,
  };
}

recordingsRouter.get("/", async (req, res) => {
  const { page, pageSize, skip, take } = paging(req.query);
  const where = readableRecordingsWhere(req.user!);
  const [count, recordings] = await Promise.all([
    prisma.recording.count({ where }),
    prisma.recording.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
  ]);
  res.json(
    paginated(count, page, pageSize, recordings.map(serializeRecording)),
  );
});

recordingsRouter.get("/:id", async (req, res) => {
  const r = await prisma.recording.findFirst({
    where: { id: req.params.id, ...readableRecordingsWhere(req.user!) },
  });
  if (!r) return res.status(404).json({ detail: "Recording not found." });
  res.json(serializeRecording(r));
});

/** Object key inside the dedicated recordings bucket. */
function recordingKey(r: import("@prisma/client").Recording): string {
  const ext = r.mode === "TRANSCRIPT" ? "ogg" : "mp4";
  return `${env.recording.outputFolder}/${r.id}.${ext}`;
}

/**
 * GET /:id/media/ — stream the recording file to an authorized user (its owner,
 * or anyone who attended the recorded session). The recordings bucket is private
 * (not exposed via nginx), so the backend proxies the object after enforcing the
 * access check itself.
 */
recordingsRouter.get("/:id/media/", async (req, res) => {
  const r = await prisma.recording.findFirst({
    where: { id: req.params.id, ...readableRecordingsWhere(req.user!) },
  });
  if (!r) return res.status(404).json({ detail: "Recording not found." });

  const ext = r.mode === "TRANSCRIPT" ? "ogg" : "mp4";
  // Played in the browser by default; the download button asks for ?download=1.
  // An `attachment` disposition would otherwise make every <video> save the file
  // instead of showing it.
  const wantsDownload = req.query.download === "1";
  const range =
    typeof req.headers.range === "string" ? req.headers.range : undefined;

  try {
    const obj = await getObjectStream(
      recordingKey(r),
      env.recording.bucket,
      range,
    );
    if (!obj.body)
      return res.status(404).json({ detail: "Recording file not found." });

    res.setHeader(
      "Content-Type",
      obj.contentType || (ext === "ogg" ? "audio/ogg" : "video/mp4"),
    );
    // Announced even on a full response: it is how the player learns it may seek.
    res.setHeader("Accept-Ranges", "bytes");
    if (obj.contentLength != null)
      res.setHeader("Content-Length", String(obj.contentLength));
    if (obj.contentRange) {
      res.setHeader("Content-Range", obj.contentRange);
      res.status(206);
    }
    res.setHeader(
      "Content-Disposition",
      `${wantsDownload ? "attachment" : "inline"}; filename="${r.id}.${ext}"`,
    );
    res.setHeader("Cache-Control", "private, max-age=0, no-store");
    obj.body.pipe(res).on("error", (err) => {
      logger.error("[recording] stream error", err);
      if (!res.headersSent) res.status(502).end();
    });
  } catch (err) {
    logger.error("[recording] media fetch failed", err);
    return res.status(404).json({ detail: "Recording file not found." });
  }
});

recordingsRouter.delete("/:id", async (req, res) => {
  const r = await prisma.recording.findFirst({
    where: {
      id: req.params.id,
      accesses: {
        some: { userId: req.user!.id, role: { in: ["OWNER", "ADMIN"] } },
      },
    },
  });
  if (!r) return res.status(404).json({ detail: "Recording not found." });
  const final = [
    "STOPPED",
    "SAVED",
    "ABORTED",
    "FAILED_TO_START",
    "FAILED_TO_STOP",
    "NOTIFICATION_SUCCEEDED",
  ];
  if (!final.includes(r.status)) {
    return res
      .status(409)
      .json({ detail: "Cannot delete a recording that is not finished." });
  }
  // Best-effort removal of the stored file before dropping the DB row.
  await deleteObject(recordingKey(r), env.recording.bucket).catch((err) =>
    logger.warn("[recording] object delete failed", err),
  );
  await prisma.recording.delete({ where: { id: r.id } });
  res.status(204).send();
});
