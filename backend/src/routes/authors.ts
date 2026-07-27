import { prisma } from '../db.ts'
import type { Prisma } from '../generated/prisma/client.ts'
import { conflict, notFound, readJson, type Ctx, type Router } from '../http.ts'
import { idParam, optionalString, requiredString } from '../validate.ts'

const authorSelect = {
  id: true,
  name: true,
  nationality: true,
  _count: { select: { books: true } },
} satisfies Prisma.AuthorSelect

type AuthorRecord = Prisma.AuthorGetPayload<{ select: typeof authorSelect }>

function toAuthor(author: AuthorRecord) {
  return {
    id: author.id,
    name: author.name,
    nationality: author.nationality,
    bookCount: author._count.books,
  }
}

export function registerAuthorRoutes(router: Router): void {
  router.get('/api/authors', async ({ query: q }: Ctx) => {
    const authors = await prisma.author.findMany({
      where: q.get('missingNationality') === 'true' ? { nationality: null } : {},
      orderBy: { name: 'asc' },
      select: authorSelect,
    })
    return authors.map(toAuthor)
  })

  router.patch('/api/authors/:id', async ({ req, params }: Ctx) => {
    const id = idParam(params.id)
    const existing = await prisma.author.findUnique({ where: { id }, select: { id: true } })
    if (!existing) throw notFound('No such author')

    const body = await readJson(req)
    const data: Prisma.AuthorUpdateInput = {}

    if (body.name !== undefined) {
      const name = requiredString(body.name, 'name', 200)
      const clash = await prisma.author.findFirst({
        where: { name: { equals: name, mode: 'insensitive' }, id: { not: id } },
        select: { id: true },
      })
      if (clash) throw conflict('Another author already has that name', { authorId: clash.id })
      data.name = name
    }

    if (body.nationality !== undefined) {
      data.nationality = optionalString(body.nationality, 'nationality', 100)
    }

    if (Object.keys(data).length > 0) await prisma.author.update({ where: { id }, data })

    const author = await prisma.author.findUnique({ where: { id }, select: authorSelect })
    return author ? toAuthor(author) : null
  })

  router.delete('/api/authors/:id', async ({ params }: Ctx) => {
    const id = idParam(params.id)
    const author = await prisma.author.findUnique({ where: { id }, select: authorSelect })
    if (!author) throw notFound('No such author')
    if (author._count.books > 0) {
      throw conflict(`That author is still linked to ${author._count.books} book(s)`)
    }
    await prisma.author.delete({ where: { id } })
    return { deleted: id }
  })

  router.post('/api/authors/:id/merge', async ({ req, params }: Ctx) => {
    const keepId = idParam(params.id)
    const body = await readJson(req)
    const mergeId = idParam(String(body.authorId), 'authorId')
    if (keepId === mergeId) throw conflict('Cannot merge an author into itself')

    await prisma.$transaction(async (tx) => {
      const mergeLinks = await tx.bookAuthor.findMany({
        where: { authorId: mergeId },
        select: { bookId: true },
      })
      const keepLinks = await tx.bookAuthor.findMany({
        where: { authorId: keepId },
        select: { bookId: true },
      })

      const alreadyKept = new Set(keepLinks.map((link) => link.bookId))
      const movable = mergeLinks.map((link) => link.bookId).filter((id) => !alreadyKept.has(id))

      if (movable.length > 0) {
        await tx.bookAuthor.updateMany({
          where: { authorId: mergeId, bookId: { in: movable } },
          data: { authorId: keepId },
        })
      }

      await tx.bookAuthor.deleteMany({ where: { authorId: mergeId } })
      await tx.author.deleteMany({ where: { id: mergeId } })
    })

    return { merged: mergeId, into: keepId }
  })
}
