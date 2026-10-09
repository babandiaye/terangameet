import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { FOLD_FROM, FOLD_TO, searchTerms } from '../lib/peopleSearch'

export interface PersonSuggestion {
  id: string
  full_name: string | null
  email: string
}

/**
 * Active members of the platform matching a name or an address, for the
 * participant pickers (room list, scheduled meeting guests). Every word must
 * match the name or the email, accent- and case-insensitively; names starting
 * with the first word come first. Only name and email are returned.
 */
export async function findPeople(
  query: string,
  exclude: { emails?: Prisma.Sql; userIds?: Prisma.Sql } = {}
): Promise<PersonSuggestion[]> {
  const terms = searchTerms(query)
  if (!terms.length) return []
  const foldedName = Prisma.sql`translate(lower(coalesce(u."fullName", '')), ${FOLD_FROM}, ${FOLD_TO})`
  const matches = terms.map(
    (t) => Prisma.sql`(${foldedName} LIKE ${'%' + t + '%'} OR lower(u.email) LIKE ${'%' + t + '%'})`
  )
  const rows = await prisma.$queryRaw<PersonSuggestion[]>(Prisma.sql`
    SELECT u.id, u."fullName" AS full_name, lower(u.email) AS email
    FROM users u
    WHERE u."isActive" AND u.email IS NOT NULL
      ${exclude.emails ? Prisma.sql`AND lower(u.email) NOT IN (${exclude.emails})` : Prisma.empty}
      ${exclude.userIds ? Prisma.sql`AND u.id NOT IN (${exclude.userIds})` : Prisma.empty}
      AND ${Prisma.join(matches, ' AND ')}
    ORDER BY (${foldedName} LIKE ${terms[0] + '%'}) DESC, u."fullName" ASC NULLS LAST
    LIMIT 8`)
  return rows
}

/**
 * Account names by (lowercased) email, for the addresses that belong to a
 * member of the platform — used to show names rather than addresses in
 * participant and guest lists. Account emails are stored as SenID sends them,
 * hence the comparison on lower().
 */
export async function accountNames(emails: string[]): Promise<Map<string, string | null>> {
  if (!emails.length) return new Map()
  const rows = await prisma.$queryRaw<{ email: string; full_name: string | null }[]>(Prisma.sql`
    SELECT lower(email) AS email, "fullName" AS full_name
    FROM users WHERE lower(email) IN (${Prisma.join(emails)})`)
  return new Map(rows.map((r) => [r.email, r.full_name]))
}
