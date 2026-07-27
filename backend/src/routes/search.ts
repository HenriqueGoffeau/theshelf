import { prisma } from '../db.ts'
import type { Prisma } from '../generated/prisma/client.ts'
import { type Ctx, type Router } from '../http.ts'
import { spineSelect, toSpine } from '../serialize.ts'
import { resolveSpine } from '../spine.ts'
import { queryInt } from '../validate.ts'

const FACETS = ['books', 'notes', 'wishlist', 'authors'] as const
type Facet = (typeof FACETS)[number]

function bookMatch(term: string): Prisma.BookWhereInput {
  const like: Prisma.StringFilter = { contains: term, mode: 'insensitive' }
  return {
    OR: [
      { title: like },
      { subtitle: like },
      { publisher: like },
      { authors: { some: { author: { name: like } } } },
    ],
  }
}

const searchBookSelect = {
  ...spineSelect,
  shelves: {
    where: { shelf: { kind: 'manual' as const } },
    orderBy: { shelf: { position: 'asc' as const } },
    take: 1,
    select: { shelf: { select: { name: true } } },
  },
} satisfies Prisma.BookSelect

export function registerSearchRoutes(router: Router): void {
  router.get('/api/search', async ({ query: q }: Ctx) => {
    const term = q.get('q')?.trim() ?? ''
    const requested = q.get('facet')
    const facet: Facet = FACETS.includes(requested as Facet) ? (requested as Facet) : 'books'
    const limit = queryInt(q, 'limit', 30, 1, 100)

    if (!term) {
      return { term, facet, counts: { books: 0, notes: 0, wishlist: 0, authors: 0 }, items: [] }
    }

    const match = bookMatch(term)
    const insensitive: Prisma.StringFilter = { contains: term, mode: 'insensitive' }

    const [books, notes, wishlist, authors] = await prisma.$transaction([
      prisma.book.count({ where: { ...match, location: 'owned' } }),
      prisma.note.count({ where: { text: insensitive } }),
      prisma.book.count({ where: { ...match, location: 'wishlist' } }),
      prisma.author.count({ where: { name: insensitive } }),
    ])

    const counts = { books, notes, wishlist, authors }
    let items: unknown[] = []

    if (facet === 'books' || facet === 'wishlist') {
      const rows = await prisma.book.findMany({
        where: { ...match, location: facet === 'books' ? 'owned' : 'wishlist' },
        orderBy: { title: 'asc' },
        select: searchBookSelect,
        take: limit,
      })
      items = rows.map((row) => ({
        ...toSpine(row),
        shelfName: row.shelves[0]?.shelf.name ?? null,
      }))
    } else if (facet === 'notes') {
      const rows = await prisma.note.findMany({
        where: { text: insensitive },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          bookId: true,
          page: true,
          kind: true,
          text: true,
          createdAt: true,
          book: { select: { title: true, spineColor: true } },
        },
      })
      items = rows.map((row) => ({
        id: row.id,
        bookId: row.bookId,
        page: row.page,
        kind: row.kind,
        text: row.text,
        createdAt: row.createdAt,
        bookTitle: row.book.title,
        spineColor: resolveSpine({ id: row.bookId, spineColor: row.book.spineColor }).spineColor,
      }))
    } else {
      const rows = await prisma.author.findMany({
        where: { name: insensitive },
        select: { id: true, name: true, nationality: true, _count: { select: { books: true } } },
      })
      items = rows
        .map((row) => ({
          id: row.id,
          name: row.name,
          nationality: row.nationality,
          bookCount: row._count.books,
        }))
        .sort((a, b) => b.bookCount - a.bookCount || a.name.localeCompare(b.name))
        .slice(0, limit)
    }

    return { term, facet, counts, items }
  })
}
