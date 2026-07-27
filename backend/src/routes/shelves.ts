import { prisma } from '../db.ts'
import { Prisma } from '../generated/prisma/client.ts'
import { badRequest, conflict, created, notFound, readJson, type Ctx, type Router } from '../http.ts'
import { spineSelect, toSpine } from '../serialize.ts'
import { READING_STATUSES } from '../spine.ts'
import type { ReadingStatus } from '../spine.ts'
import { idParam, optionalString, queryInt, requiredString } from '../validate.ts'

const shelfSelect = {
  id: true,
  name: true,
  note: true,
  kind: true,
  query: true,
  position: true,
  createdAt: true,
  _count: { select: { books: true } },
} satisfies Prisma.ShelfSelect

type ShelfRecord = Prisma.ShelfGetPayload<{ select: typeof shelfSelect }>

type ShelfView = {
  id: number
  name: string
  note: string | null
  kind: 'manual' | 'smart'
  position: number
  createdAt: Date
  bookCount: number
  query: Prisma.JsonValue
}

function toShelf(shelf: ShelfRecord): ShelfView {
  return {
    id: shelf.id,
    name: shelf.name,
    note: shelf.note,
    kind: shelf.kind,
    position: shelf.position,
    createdAt: shelf.createdAt,
    bookCount: shelf._count.books,
    query: shelf.query,
  }
}

function readingStatusOf(query: Prisma.JsonValue): ReadingStatus | null {
  if (query === null || typeof query !== 'object' || Array.isArray(query)) return null
  const raw = (query as Record<string, unknown>).readingStatus
  if (typeof raw !== 'string') return null
  return (READING_STATUSES as readonly string[]).includes(raw) ? (raw as ReadingStatus) : null
}

function smartWhere(shelf: ShelfView): Prisma.BookWhereInput {
  const status = readingStatusOf(shelf.query)
  return status === null ? { location: 'owned' } : { location: 'owned', readingStatus: status }
}

function decodeCursor(raw: string | null): { sort: number; id: number } | null {
  if (!raw) return null
  const [sort, id] = raw.split('_')
  const parsedSort = Number(sort)
  const parsedId = Number(id)
  if (!Number.isFinite(parsedSort) || !Number.isInteger(parsedId)) {
    throw badRequest('That cursor is not valid')
  }
  return { sort: parsedSort, id: parsedId }
}

export async function shelfBooks(
  shelf: ShelfView,
  limit: number,
  cursorRaw: string | null,
): Promise<{ books: unknown[]; nextCursor: string | null; total: number }> {
  const cursor = decodeCursor(cursorRaw)

  if (shelf.kind === 'smart') {
    const where = smartWhere(shelf)

    const [rows, total] = await prisma.$transaction([
      prisma.book.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { ...spineSelect, createdAt: true },
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
      }),
      prisma.book.count({ where }),
    ])

    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const last = page[page.length - 1]

    return {
      books: page.map(toSpine),
      nextCursor: hasMore && last ? `${last.createdAt.getTime()}_${last.id}` : null,
      total,
    }
  }

  const rows = await prisma.shelfBook.findMany({
    where: { shelfId: shelf.id },
    orderBy: [{ position: 'asc' }, { bookId: 'asc' }],
    select: { position: true, bookId: true, book: { select: spineSelect } },
    take: limit + 1,
    ...(cursor
      ? { cursor: { shelfId_bookId: { shelfId: shelf.id, bookId: cursor.id } }, skip: 1 }
      : {}),
  })

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const last = page[page.length - 1]

  return {
    books: page.map((row) => toSpine(row.book)),
    nextCursor: hasMore && last ? `${last.position}_${last.bookId}` : null,
    total: shelf.bookCount,
  }
}

async function requireShelf(id: number): Promise<ShelfView> {
  const shelf = await prisma.shelf.findUnique({ where: { id }, select: shelfSelect })
  if (!shelf) throw notFound('No such shelf')
  return toShelf(shelf)
}

export function registerShelfRoutes(router: Router): void {
  router.get('/api/room', async ({ query: q }: Ctx) => {
    const perShelf = queryInt(q, 'perShelf', 40, 1, 200)
    const collectionId = q.get('collection')
    const scope = collectionId ? idParam(collectionId, 'collection') : null

    const shelves = scope
      ? [await requireShelf(scope)]
      : (
          await prisma.shelf.findMany({
            where: { kind: 'smart' },
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
            select: shelfSelect,
          })
        ).map(toShelf)

    const rows = await Promise.all(
      shelves.map(async (shelf) => {
        const page = await shelfBooks(shelf, perShelf, null)
        return {
          id: shelf.id,
          name: shelf.name,
          note: shelf.note,
          kind: shelf.kind,
          canReorder: shelf.kind === 'manual',
          total: page.total,
          books: page.books,
          nextCursor: page.nextCursor,
        }
      }),
    )

    const scoped: Prisma.BookWhereInput = scope ? { shelves: { some: { shelfId: scope } } } : {}

    const [all, reading, finished, aside, unread, wishlist, collections] = await prisma.$transaction([
      prisma.book.count({ where: { ...scoped, location: 'owned' } }),
      prisma.book.count({ where: { ...scoped, location: 'owned', readingStatus: 'reading' } }),
      prisma.book.count({ where: { ...scoped, location: 'owned', readingStatus: 'finished' } }),
      prisma.book.count({ where: { ...scoped, location: 'owned', readingStatus: 'aside' } }),
      prisma.book.count({ where: { ...scoped, location: 'owned', readingStatus: 'unread' } }),
      prisma.book.count({ where: { ...scoped, location: 'wishlist' } }),
      prisma.shelf.findMany({
        where: { kind: 'manual' },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        select: shelfSelect,
      }),
    ])

    return {
      shelves: rows,
      counts: { all, reading, finished, aside, unread, wishlist },
      collections: collections.map(toShelf),
    }
  })

  router.get('/api/shelves', async ({ query: q }: Ctx) => {
    const kind = q.get('kind')
    const shelves = await prisma.shelf.findMany({
      where: kind === 'manual' || kind === 'smart' ? { kind } : {},
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: shelfSelect,
    })
    return shelves.map(toShelf)
  })

  router.get('/api/shelves/:id', async ({ params, query: q }: Ctx) => {
    const shelf = await requireShelf(idParam(params.id))
    const page = await shelfBooks(shelf, queryInt(q, 'limit', 40, 1, 200), q.get('cursor'))
    return { ...shelf, canReorder: shelf.kind === 'manual', ...page }
  })

  router.get('/api/shelves/:id/books', async ({ params, query: q }: Ctx) => {
    const shelf = await requireShelf(idParam(params.id))
    return shelfBooks(shelf, queryInt(q, 'limit', 40, 1, 200), q.get('cursor'))
  })

  router.post('/api/shelves', async ({ req }: Ctx) => {
    const body = await readJson(req)
    const name = requiredString(body.name, 'name', 200)
    const note = optionalString(body.note, 'note', 2000) ?? null

    const clash = await prisma.shelf.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    })
    if (clash) throw conflict('You already have a shelf with that name', { shelfId: clash.id })

    const highest = await prisma.shelf.aggregate({ _max: { position: true } })
    const shelf = await prisma.shelf.create({
      data: { name, note, kind: 'manual', position: (highest._max.position ?? -1) + 1 },
      select: { id: true },
    })

    return created(await requireShelf(shelf.id))
  })

  router.patch('/api/shelves/:id', async ({ req, params }: Ctx) => {
    const id = idParam(params.id)
    const shelf = await requireShelf(id)
    const body = await readJson(req)
    const data: Prisma.ShelfUpdateInput = {}

    if (body.name !== undefined) {
      if (shelf.kind === 'smart') throw conflict('The automatic shelves cannot be renamed')
      const name = requiredString(body.name, 'name', 200)
      const clash = await prisma.shelf.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, id: { not: id } },
        select: { id: true },
      })
      if (clash) throw conflict('Another shelf already has that name', { shelfId: clash.id })
      data.name = name
    }
    if (body.note !== undefined) data.note = optionalString(body.note, 'note', 2000)

    if (Object.keys(data).length > 0) await prisma.shelf.update({ where: { id }, data })
    return requireShelf(id)
  })

  router.delete('/api/shelves/:id', async ({ params }: Ctx) => {
    const id = idParam(params.id)
    const shelf = await requireShelf(id)
    if (shelf.kind === 'smart') throw conflict('The automatic shelves cannot be deleted')
    await prisma.shelf.delete({ where: { id } })
    return { deleted: id }
  })

  router.post('/api/shelves/:id/books', async ({ req, params }: Ctx) => {
    const id = idParam(params.id)
    const shelf = await requireShelf(id)
    if (shelf.kind === 'smart') throw conflict('Books arrive on the automatic shelves by themselves')

    const body = await readJson(req)
    const bookId = idParam(String(body.bookId), 'bookId')
    const book = await prisma.book.findUnique({ where: { id: bookId }, select: { id: true } })
    if (!book) throw notFound('No such book')

    const highest = await prisma.shelfBook.aggregate({
      where: { shelfId: id },
      _max: { position: true },
    })
    await prisma.shelfBook.createMany({
      data: [{ shelfId: id, bookId, position: (highest._max.position ?? -1) + 1 }],
      skipDuplicates: true,
    })

    return { shelfId: id, bookId }
  })

  router.delete('/api/shelves/:id/books/:bookId', async ({ params }: Ctx) => {
    const id = idParam(params.id)
    const bookId = idParam(params.bookId, 'bookId')
    await prisma.shelfBook.deleteMany({ where: { shelfId: id, bookId } })
    return { shelfId: id, bookId }
  })

  router.patch('/api/shelves/:id/order', async ({ req, params }: Ctx) => {
    const id = idParam(params.id)
    const shelf = await requireShelf(id)
    if (shelf.kind !== 'manual') {
      throw conflict('That shelf orders itself — only your own shelves can be rearranged')
    }

    const body = await readJson(req)
    const bookId = idParam(String(body.bookId), 'bookId')
    const afterBookId =
      body.afterBookId === null || body.afterBookId === undefined
        ? null
        : idParam(String(body.afterBookId), 'afterBookId')

    if (afterBookId === bookId) throw badRequest('A book cannot follow itself')

    const order = await prisma.$transaction(async (tx) => {
      const rows = await tx.shelfBook.findMany({
        where: { shelfId: id },
        orderBy: [{ position: 'asc' }, { bookId: 'asc' }],
        select: { bookId: true },
      })

      const ids = rows.map((row) => row.bookId)
      if (!ids.includes(bookId)) throw notFound('That book is not on this shelf')
      if (afterBookId !== null && !ids.includes(afterBookId)) {
        throw notFound('The book to drop it after is not on this shelf')
      }

      const without = ids.filter((entry) => entry !== bookId)
      const at = afterBookId === null ? 0 : without.indexOf(afterBookId) + 1
      without.splice(at, 0, bookId)

      const values = without.map((entry, index) => Prisma.sql`(${entry}::int, ${index}::int)`)
      await tx.$executeRaw`
        update shelf_book sb
        set position = v.position
        from (values ${Prisma.join(values)}) as v(book_id, position)
        where sb.shelf_id = ${id} and sb.book_id = v.book_id
      `

      return without
    })

    return { shelfId: id, order }
  })
}
