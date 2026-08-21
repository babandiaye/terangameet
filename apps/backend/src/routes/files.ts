import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { env } from '../config/env'
import { requireAuth } from '../auth/middleware'
import { s3Configured, presignPut, presignGet, deleteObject } from '../lib/s3'

export const filesRouter = Router()

function ext(filename: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(filename)
  return m ? m[1].toLowerCase() : ''
}
const fileKey = (id: string, e: string) => `${env.files.uploadEnabled ? 'files' : 'files'}/${id}${e ? '.' + e : ''}`

async function serialize(f: import('@prisma/client').File) {
  const creator = f.creatorId
    ? await prisma.user.findUnique({ where: { id: f.creatorId } })
    : null
  const base = {
    id: f.id,
    created_at: f.createdAt.toISOString(),
    updated_at: f.updatedAt.toISOString(),
    title: f.title,
    type: 'background_image' as const,
    creator: creator
      ? { id: creator.id, full_name: creator.fullName, short_name: creator.shortName }
      : { id: '', full_name: null, short_name: null },
    deleted_at: f.deletedAt?.toISOString() ?? null,
    hard_deleted_at: f.hardDeletedAt?.toISOString() ?? null,
    filename: f.filename,
    upload_state: f.uploadState.toLowerCase(),
    mimetype: f.mimetype ?? '',
    size: Number(f.size ?? 0),
    description: f.description ?? null,
  }
  if (f.uploadState === 'READY') {
    return { ...base, url: await presignGet(fileKey(f.id, ext(f.filename))) }
  }
  if (f.uploadState === 'PENDING') {
    return {
      ...base,
      url: null,
      policy: await presignPut(fileKey(f.id, ext(f.filename)), f.mimetype ?? undefined),
    }
  }
  return base
}

filesRouter.use(requireAuth)

/** GET /api/v1.0/files/ — list current user's files. */
filesRouter.get('/', async (req, res) => {
  const files = await prisma.file.findMany({
    where: { creatorId: req.user!.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  res.json(await Promise.all(files.map(serialize)))
})

/** POST /api/v1.0/files/ — create a file and return a presigned upload URL. */
filesRouter.post('/', async (req, res) => {
  if (!env.files.uploadEnabled || !s3Configured()) {
    return res.status(403).json({ detail: 'File upload is disabled.' })
  }
  const schema = z.object({
    filename: z.string().min(1).max(255),
    type: z.literal('background_image').default('background_image'),
    title: z.string().max(255).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ detail: 'Invalid payload.' })

  const e = ext(parsed.data.filename)
  if (env.files.allowedExtensions.length && !env.files.allowedExtensions.includes(e)) {
    return res.status(400).json({ detail: `Extension .${e} not allowed.` })
  }
  const count = await prisma.file.count({ where: { creatorId: req.user!.id, deletedAt: null } })
  if (count >= env.files.maxCountByUser) {
    return res.status(400).json({ detail: 'Upload quota reached.' })
  }

  const file = await prisma.file.create({
    data: {
      title: parsed.data.title ?? parsed.data.filename,
      filename: parsed.data.filename,
      creatorId: req.user!.id,
      uploadState: 'PENDING',
      mimetype: guessMime(e),
    },
  })
  res.status(201).json(await serialize(file))
})

/** POST /api/v1.0/files/:id/upload-ended/ — finalize an upload. */
filesRouter.post('/:id/upload-ended/', async (req, res) => {
  const file = await prisma.file.findFirst({
    where: { id: req.params.id, creatorId: req.user!.id },
  })
  if (!file) return res.status(404).json({ detail: 'File not found.' })
  const updated = await prisma.file.update({
    where: { id: file.id },
    data: { uploadState: 'READY' },
  })
  res.json(await serialize(updated))
})

/** DELETE /api/v1.0/files/:id/ — soft delete + best-effort storage cleanup. */
filesRouter.delete('/:id', async (req, res) => {
  const file = await prisma.file.findFirst({
    where: { id: req.params.id, creatorId: req.user!.id },
  })
  if (!file) return res.status(404).json({ detail: 'File not found.' })
  await prisma.file.update({ where: { id: file.id }, data: { deletedAt: new Date() } })
  if (s3Configured()) {
    try {
      await deleteObject(fileKey(file.id, ext(file.filename)))
    } catch {
      /* best effort */
    }
  }
  res.status(204).send()
})

function guessMime(e: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  }
  return map[e] ?? 'application/octet-stream'
}
