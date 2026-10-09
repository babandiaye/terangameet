import { Router } from "express";
import { recordingStatusToApi } from "../../lib/recordingStatus";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";
import { paging } from "../../lib/pagination";
import { userBrief } from "./shared";

/** Administration — recordings. */
export const recordingsRouter = Router();

/* ------------------------------------------------------------- recordings -- */

recordingsRouter.get("/recordings/", async (req, res) => {
  const { page, pageSize, skip, take } = paging(req.query);
  // Sorting: ?sort=date|user & ?order=asc|desc (default: date desc).
  const order: Prisma.SortOrder = req.query.order === "asc" ? "asc" : "desc";
  const orderBy: Prisma.RecordingOrderByWithRelationInput =
    req.query.sort === "user"
      ? { creator: { fullName: order } }
      : { createdAt: order };

  const [total, recordings] = await Promise.all([
    prisma.recording.count(),
    prisma.recording.findMany({
      orderBy,
      skip,
      take,
      include: {
        room: { select: { id: true, name: true } },
        creator: {
          select: { id: true, fullName: true, email: true, shortName: true },
        },
      },
    }),
  ]);

  const expDays = env.recording.expirationDays;
  res.json({
    count: total,
    page,
    page_size: pageSize,
    results: recordings.map((r) => {
      const expiredAt = expDays
        ? new Date(r.createdAt.getTime() + expDays * 86400000)
        : null;
      return {
        id: r.id,
        room: r.room ? { id: r.room.id, name: r.room.name } : null,
        creator: r.creator ? userBrief(r.creator) : null,
        // Same vocabulary as /recordings/ and /me/recordings/.
        status: recordingStatusToApi(r.status),
        mode: r.mode.toLowerCase(),
        created_at: r.createdAt.toISOString(),
        expired_at: expiredAt?.toISOString() ?? null,
      };
    }),
  });
});
