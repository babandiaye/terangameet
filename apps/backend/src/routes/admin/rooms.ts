import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { paging } from "../../lib/pagination";
import { userBrief } from "./shared";

/** Administration — rooms. */
export const roomsRouter = Router();

/* ------------------------------------------------------------------ rooms -- */

roomsRouter.get("/rooms/", async (req, res) => {
  const { page, pageSize, skip, take } = paging(req.query);
  const search = String(req.query.search ?? "").trim();
  const where: Prisma.RoomWhereInput = search
    ? { name: { contains: search, mode: "insensitive" } }
    : {};

  const order: Prisma.SortOrder = req.query.order === "asc" ? "asc" : "desc";
  const orderBy: Prisma.RoomOrderByWithRelationInput =
    req.query.sort === "name"
      ? { name: order }
      : req.query.sort === "sessions"
        ? { sessions: { _count: order } }
        : req.query.sort === "recordings"
          ? { recordings: { _count: order } }
          : { createdAt: order };

  const [total, rooms] = await Promise.all([
    prisma.room.count({ where }),
    prisma.room.findMany({
      where,
      orderBy,
      skip,
      take,
      include: {
        _count: { select: { sessions: true, recordings: true } },
        accesses: {
          where: { role: "OWNER" },
          take: 1,
          orderBy: { createdAt: "asc" },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                shortName: true,
              },
            },
          },
        },
      },
    }),
  ]);

  res.json({
    count: total,
    page,
    page_size: pageSize,
    results: rooms.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      access_level: r.accessLevel.toLowerCase(),
      created_at: r.createdAt.toISOString(),
      owner: r.accesses[0]?.user ? userBrief(r.accesses[0].user) : null,
      sessions: r._count.sessions,
      recordings: r._count.recordings,
    })),
  });
});
