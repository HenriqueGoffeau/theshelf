import { prisma } from '../db.ts'
import { conflict, notFound, readJson, type Ctx, type Router } from '../http.ts'
import { idParam, requiredString } from '../validate.ts'

export function registerGenreRoutes(router: Router): void {
  router.get('/api/genres', async () => {
    const genres = await prisma.genre.findMany({
      select: { id: true, name: true, _count: { select: { books: true } } },
    })

    return genres
      .map((genre) => ({ id: genre.id, name: genre.name, bookCount: genre._count.books }))
      .sort((a, b) => b.bookCount - a.bookCount || a.name.localeCompare(b.name))
  })

  router.patch('/api/genres/:id', async ({ req, params }: Ctx) => {
    const id = idParam(params.id)
    const existing = await prisma.genre.findUnique({ where: { id }, select: { id: true } })
    if (!existing) throw notFound('No such genre')

    const body = await readJson(req)
    const name = requiredString(body.name, 'name', 200)
    const clash = await prisma.genre.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, id: { not: id } },
      select: { id: true },
    })
    if (clash) throw conflict('Another genre already has that name', { genreId: clash.id })

    return prisma.genre.update({ where: { id }, data: { name }, select: { id: true, name: true } })
  })

  router.delete('/api/genres/:id', async ({ params }: Ctx) => {
    const id = idParam(params.id)
    const existing = await prisma.genre.findUnique({ where: { id }, select: { id: true } })
    if (!existing) throw notFound('No such genre')
    await prisma.genre.delete({ where: { id } })
    return { deleted: id }
  })
}
