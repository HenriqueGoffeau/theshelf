import { prisma } from '../db.ts'
import type { Prisma } from '../generated/prisma/client.ts'
import { conflict, created, notFound, readJson, type Ctx, type Router } from '../http.ts'
import { normalizeIsbn, isValidIsbn, splitIsbns } from '../isbn.ts'
import { bookSelect, fromDateOnly, toBook } from '../serialize.ts'
import { LOCATIONS, READING_STATUSES } from '../spine.ts'
import { pruneOrphans, setBookAuthors, setBookGenres } from '../taxonomy.ts'
import {
  idParam,
  optionalDate,
  optionalEnum,
  optionalInt,
  optionalString,
  queryInt,
  requiredString,
  stringList,
} from '../validate.ts'

const DEFAULT_SORT: Prisma.BookOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }]

const SORTS: Record<string, Prisma.BookOrderByWithRelationInput[]> = {
  added_desc: DEFAULT_SORT,
  added_asc: [{ createdAt: 'asc' }, { id: 'asc' }],
  title_asc: [{ title: 'asc' }],
  title_desc: [{ title: 'desc' }],
  year_desc: [{ publishedYear: { sort: 'desc', nulls: 'last' } }, { title: 'asc' }],
  year_asc: [{ publishedYear: { sort: 'asc', nulls: 'last' } }, { title: 'asc' }],
  rating_desc: [{ rating: { sort: 'desc', nulls: 'last' } }, { title: 'asc' }],
  rating_asc: [{ rating: { sort: 'asc', nulls: 'last' } }, { title: 'asc' }],
  pages_desc: [{ pageCount: { sort: 'desc', nulls: 'last' } }, { title: 'asc' }],
}

export function buildFilters(q: URLSearchParams, forcedLocation?: string): Prisma.BookWhereInput {
  const and: Prisma.BookWhereInput[] = []

  const location = forcedLocation ?? q.get('location') ?? 'owned'
  if (location !== 'all') {
    and.push({ location: optionalEnum(location, 'location', LOCATIONS) ?? 'owned' })
  }

  const search = q.get('q')?.trim()
  if (search) {
    const like: Prisma.StringFilter = { contains: search, mode: 'insensitive' }
    const isbn = normalizeIsbn(search)
    const or: Prisma.BookWhereInput[] = [
      { title: like },
      { subtitle: like },
      { publisher: like },
      { authors: { some: { author: { name: like } } } },
      { notes: { some: { text: like } } },
    ]
    if (isbn) {
      or.push({ isbn13: { contains: isbn } }, { isbn10: { contains: isbn } })
    }
    and.push({ OR: or })
  }

  const authorId = q.get('authorId')
  if (authorId) and.push({ authors: { some: { authorId: idParam(authorId, 'authorId') } } })

  const genreId = q.get('genreId')
  if (genreId) and.push({ genres: { some: { genreId: idParam(genreId, 'genreId') } } })

  const shelfId = q.get('shelfId')
  if (shelfId) and.push({ shelves: { some: { shelfId: idParam(shelfId, 'shelfId') } } })

  const nationality = q.get('nationality')?.trim()
  if (nationality) {
    and.push({
      authors: { some: { author: { nationality: { equals: nationality, mode: 'insensitive' } } } },
    })
  }

  const publisher = q.get('publisher')?.trim()
  if (publisher) and.push({ publisher: { equals: publisher, mode: 'insensitive' } })

  const language = q.get('language')?.trim()
  if (language) and.push({ language: { equals: language, mode: 'insensitive' } })

  if (q.get('year')) and.push({ publishedYear: queryInt(q, 'year', 0, 0, 3000) })
  if (q.get('yearFrom')) and.push({ publishedYear: { gte: queryInt(q, 'yearFrom', 0, 0, 3000) } })
  if (q.get('yearTo')) and.push({ publishedYear: { lte: queryInt(q, 'yearTo', 3000, 0, 3000) } })

  const status = optionalEnum(q.get('readingStatus'), 'readingStatus', READING_STATUSES)
  if (status) and.push({ readingStatus: status })

  if (q.get('minRating')) and.push({ rating: { gte: queryInt(q, 'minRating', 1, 1, 5) } })
  if (q.get('unrated') === 'true') and.push({ rating: null })
  if (q.get('hasNotes') === 'true') and.push({ notes: { some: {} } })

  return and.length > 0 ? { AND: and } : {}
}

async function getBook(id: number) {
  const book = await prisma.book.findUnique({ where: { id }, select: bookSelect })
  if (!book) throw notFound('That book is not on your shelves')
  return toBook(book)
}

type BookInput = Record<string, unknown>

function readBookFields(body: BookInput) {
  const isbnRaw = optionalString(body.isbn, 'isbn', 20)
  let isbn13: string | null | undefined
  let isbn10: string | null | undefined

  if (isbnRaw !== undefined) {
    if (isbnRaw === null) {
      isbn13 = null
      isbn10 = null
    } else {
      const normalized = normalizeIsbn(isbnRaw)
      const split = splitIsbns(normalized)
      isbn13 = split.isbn13
      isbn10 = split.isbn10 ?? (isValidIsbn(normalized) ? null : normalized.slice(0, 20))
    }
  }

  return {
    isbn13,
    isbn10,
    title: body.title,
    subtitle: optionalString(body.subtitle, 'subtitle', 500),
    publisher: optionalString(body.publisher, 'publisher', 300),
    publishedYear: optionalInt(body.publishedYear, 'publishedYear', 0, 2999),
    pageCount: optionalInt(body.pageCount, 'pageCount', 1, 100_000),
    language: optionalString(body.language, 'language', 80),
    description: optionalString(body.description, 'description', 20_000),
    coverUrl: optionalString(body.coverUrl, 'coverUrl', 1000),
    location: optionalEnum(body.location, 'location', LOCATIONS),
    readingStatus: optionalEnum(body.readingStatus, 'readingStatus', READING_STATUSES),
    rating: optionalInt(body.rating, 'rating', 1, 5),
    wishReason: optionalString(body.wishReason, 'wishReason', 300),
    spineColor: optionalString(body.spineColor, 'spineColor', 32),
    spineWidth: optionalInt(body.spineWidth, 'spineWidth', 16, 80),
    spineHeight: optionalInt(body.spineHeight, 'spineHeight', 90, 260),
    acquiredOn: optionalDate(body.acquiredOn, 'acquiredOn'),
    source: optionalString(body.source, 'source', 40),
    authors: stringList(body.authors, 'authors'),
    genres: stringList(body.genres, 'genres'),
  }
}

async function assertIsbnFree(isbn13: string, exceptId?: number): Promise<void> {
  const clash = await prisma.book.findFirst({
    where: exceptId === undefined ? { isbn13 } : { isbn13, id: { not: exceptId } },
    select: { id: true, title: true },
  })
  if (clash) {
    throw conflict(`"${clash.title}" already has that ISBN in your library`, { bookId: clash.id })
  }
}

export function registerBookRoutes(router: Router): void {
  router.get('/api/books', async ({ query: q }: Ctx) => {
    const where = buildFilters(q)
    const orderBy = SORTS[q.get('sort') ?? 'added_desc'] ?? DEFAULT_SORT
    const pageSize = queryInt(q, 'pageSize', 24, 1, 200)
    const page = queryInt(q, 'page', 1, 1, 10_000)

    const [items, total] = await prisma.$transaction([
      prisma.book.findMany({
        where,
        orderBy,
        select: bookSelect,
        take: pageSize,
        skip: (page - 1) * pageSize,
      }),
      prisma.book.count({ where }),
    ])

    return {
      items: items.map(toBook),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }
  })

  router.get('/api/books/:id', async ({ params }: Ctx) => getBook(idParam(params.id)))

  router.post('/api/books', async ({ req }: Ctx) => {
    const body = await readJson<BookInput>(req)
    const fields = readBookFields(body)
    const title = requiredString(fields.title, 'title')

    if (fields.isbn13) await assertIsbnFree(fields.isbn13)

    const id = await prisma.$transaction(async (tx) => {
      const book = await tx.book.create({
        data: {
          title,
          isbn13: fields.isbn13 ?? null,
          isbn10: fields.isbn10 ?? null,
          subtitle: fields.subtitle ?? null,
          publisher: fields.publisher ?? null,
          publishedYear: fields.publishedYear ?? null,
          pageCount: fields.pageCount ?? null,
          language: fields.language ?? null,
          description: fields.description ?? null,
          coverUrl: fields.coverUrl ?? null,
          source: fields.source ?? 'manual',
          location: fields.location ?? 'owned',
          readingStatus: fields.readingStatus ?? 'unread',
          rating: fields.rating ?? null,
          wishReason: fields.wishReason ?? null,
          spineColor: fields.spineColor ?? null,
          spineWidth: fields.spineWidth ?? null,
          spineHeight: fields.spineHeight ?? null,
          acquiredOn: fields.acquiredOn ? fromDateOnly(fields.acquiredOn) : null,
        },
        select: { id: true },
      })

      await setBookAuthors(tx, book.id, fields.authors ?? [])
      await setBookGenres(tx, book.id, fields.genres ?? [])
      return book.id
    })

    return created(await getBook(id))
  })

  router.patch('/api/books/:id', async ({ req, params }: Ctx) => {
    const id = idParam(params.id)
    await getBook(id)

    const body = await readJson<BookInput>(req)
    const fields = readBookFields(body)

    const data: Prisma.BookUpdateInput = {}
    if (body.title !== undefined) data.title = requiredString(fields.title, 'title')
    if (fields.isbn13 !== undefined) data.isbn13 = fields.isbn13
    if (fields.isbn10 !== undefined) data.isbn10 = fields.isbn10
    if (fields.subtitle !== undefined) data.subtitle = fields.subtitle
    if (fields.publisher !== undefined) data.publisher = fields.publisher
    if (fields.publishedYear !== undefined) data.publishedYear = fields.publishedYear
    if (fields.pageCount !== undefined) data.pageCount = fields.pageCount
    if (fields.language !== undefined) data.language = fields.language
    if (fields.description !== undefined) data.description = fields.description
    if (fields.coverUrl !== undefined) data.coverUrl = fields.coverUrl
    if (fields.location !== undefined) data.location = fields.location
    if (fields.readingStatus !== undefined) data.readingStatus = fields.readingStatus
    if (fields.rating !== undefined) data.rating = fields.rating
    if (fields.wishReason !== undefined) data.wishReason = fields.wishReason
    if (fields.spineColor !== undefined) data.spineColor = fields.spineColor
    if (fields.spineWidth !== undefined) data.spineWidth = fields.spineWidth
    if (fields.spineHeight !== undefined) data.spineHeight = fields.spineHeight
    if (fields.source != null) data.source = fields.source
    if (fields.acquiredOn !== undefined) {
      data.acquiredOn = fields.acquiredOn === null ? null : fromDateOnly(fields.acquiredOn)
    }

    if (fields.isbn13) await assertIsbnFree(fields.isbn13, id)

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) await tx.book.update({ where: { id }, data })
      if (fields.authors !== undefined) await setBookAuthors(tx, id, fields.authors)
      if (fields.genres !== undefined) await setBookGenres(tx, id, fields.genres)
      if (fields.authors !== undefined || fields.genres !== undefined) await pruneOrphans(tx)
    })

    return getBook(id)
  })

  router.delete('/api/books/:id', async ({ params }: Ctx) => {
    const id = idParam(params.id)
    await getBook(id)
    await prisma.$transaction(async (tx) => {
      await tx.book.delete({ where: { id } })
      await pruneOrphans(tx)
    })
    return { deleted: id }
  })
}
