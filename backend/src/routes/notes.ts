import { prisma } from '../db.ts'
import type { Prisma } from '../generated/prisma/client.ts'
import { created, notFound, readJson, type Ctx, type Router } from '../http.ts'
import { NOTE_KINDS, resolveSpine } from '../spine.ts'
import { idParam, optionalEnum, optionalInt, queryInt, requiredString } from '../validate.ts'

const noteSelect = {
  id: true,
  bookId: true,
  page: true,
  kind: true,
  text: true,
  createdAt: true,
  book: {
    select: {
      title: true,
      spineColor: true,
      spineWidth: true,
      spineHeight: true,
      pageCount: true,
    },
  },
} satisfies Prisma.NoteSelect

type NoteRecord = Prisma.NoteGetPayload<{ select: typeof noteSelect }>

function toNote(note: NoteRecord) {
  return {
    id: note.id,
    bookId: note.bookId,
    page: note.page,
    kind: note.kind,
    text: note.text,
    createdAt: note.createdAt,
    bookTitle: note.book.title,
    spineColor: resolveSpine({ id: note.bookId, spineColor: note.book.spineColor }).spineColor,
    spineWidth: note.book.spineWidth,
    spineHeight: note.book.spineHeight,
    pageCount: note.book.pageCount,
  }
}

async function requireNote(id: number) {
  const note = await prisma.note.findUnique({ where: { id }, select: noteSelect })
  if (!note) throw notFound('No such note')
  return note
}

export function registerNoteRoutes(router: Router): void {
  router.get('/api/notes', async ({ query: q }: Ctx) => {
    const where: Prisma.NoteWhereInput = {}

    const bookId = q.get('bookId')
    if (bookId) where.bookId = idParam(bookId, 'bookId')

    const search = q.get('q')?.trim()
    if (search) {
      where.OR = [
        { text: { contains: search, mode: 'insensitive' } },
        { book: { title: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const limit = queryInt(q, 'limit', 30, 1, 200)
    const offset = queryInt(q, 'offset', 0, 0, 100_000)

    const [rows, total] = await prisma.$transaction([
      prisma.note.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: noteSelect,
        take: limit,
        skip: offset,
      }),
      prisma.note.count({ where }),
    ])

    return { items: rows.map(toNote), total, hasMore: offset + rows.length < total }
  })

  router.post('/api/books/:id/notes', async ({ req, params }: Ctx) => {
    const bookId = idParam(params.id)
    const book = await prisma.book.findUnique({ where: { id: bookId }, select: { id: true } })
    if (!book) throw notFound('No such book')

    const body = await readJson(req)
    const text = requiredString(body.text, 'text', 20_000)
    const page = optionalInt(body.page, 'page', 1, 100_000) ?? null
    const kind = optionalEnum(body.kind, 'kind', NOTE_KINDS) ?? 'note'

    const note = await prisma.note.create({
      data: { bookId, page, kind, text },
      select: noteSelect,
    })

    return created(toNote(note))
  })

  router.patch('/api/notes/:id', async ({ req, params }: Ctx) => {
    const id = idParam(params.id)
    await requireNote(id)

    const body = await readJson(req)
    const data: Prisma.NoteUpdateInput = {}
    if (body.text !== undefined) data.text = requiredString(body.text, 'text', 20_000)
    if (body.page !== undefined) data.page = optionalInt(body.page, 'page', 1, 100_000) ?? null
    if (body.kind !== undefined) data.kind = optionalEnum(body.kind, 'kind', NOTE_KINDS) ?? 'note'

    if (Object.keys(data).length === 0) return toNote(await requireNote(id))

    const note = await prisma.note.update({ where: { id }, data, select: noteSelect })
    return toNote(note)
  })

  router.delete('/api/notes/:id', async ({ params }: Ctx) => {
    const id = idParam(params.id)
    await requireNote(id)
    await prisma.note.delete({ where: { id } })
    return { deleted: id }
  })
}
