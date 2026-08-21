/** Parse page/pageSize query params into Prisma skip/take (page 1-based). */
export function paging(q: Record<string, unknown>) {
  const page = Math.max(1, parseInt(String(q.page ?? '1'), 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(String(q.pageSize ?? '20'), 10) || 20))
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize }
}

/** Standard paginated envelope returned by list endpoints. */
export function paginated<T>(count: number, page: number, pageSize: number, results: T[]) {
  return { count, page, page_size: pageSize, results }
}
