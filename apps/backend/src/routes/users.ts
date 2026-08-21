import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { requireAuth, serializeUser } from '../auth/middleware'
import { paging, paginated } from '../lib/pagination'

export const usersRouter = Router()

/** GET /api/v1.0/users/me */
usersRouter.get('/me', requireAuth, (req, res) => {
  res.json(serializeUser(req.user!))
})

const updateSchema = z.object({
  timezone: z.string().min(1).optional(),
  language: z.string().min(2).optional(),
})

/** PATCH/PUT /api/v1.0/users/:id — only self may update prefs. */
async function updateUser(req: import('express').Request, res: import('express').Response) {
  if (!req.user) return res.status(401).json({ detail: 'Authentication required.' })
  if (req.params.id !== req.user.id) {
    return res.status(403).json({ detail: 'You can only update your own profile.' })
  }
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ detail: 'Invalid payload', errors: parsed.error.flatten() })
  }
  const user = await prisma.user.update({ where: { id: req.user.id }, data: parsed.data })
  res.json(serializeUser(user))
}

usersRouter.patch('/:id', requireAuth, updateUser)
usersRouter.put('/:id', requireAuth, updateUser)

/** GET /api/v1.0/users/?q=&page=&pageSize= — user search (disabled by default). */
usersRouter.get('/', requireAuth, async (req, res) => {
  const allow = ['1', 'true', 'yes'].includes(
    String(process.env.ALLOW_UNSECURE_USER_LISTING ?? '').toLowerCase()
  )
  const q = String(req.query.q ?? '').trim()
  const { page, pageSize, skip, take } = paging(req.query)
  if (!allow || q.length < 3) return res.json(paginated(0, page, pageSize, []))
  const where = {
    OR: [
      { email: { contains: q, mode: 'insensitive' as const } },
      { fullName: { contains: q, mode: 'insensitive' as const } },
    ],
  }
  const [count, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { fullName: 'asc' }, skip, take }),
  ])
  res.json(paginated(count, page, pageSize, users.map(serializeUser)))
})
