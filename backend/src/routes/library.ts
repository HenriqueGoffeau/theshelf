import { prisma } from '../db.ts'
import type { Router } from '../http.ts'

type NationalityRow = { value: string; bookCount: number }

export function registerLibraryRoutes(router: Router): void {
  router.get('/api/facets', async () => {
    const [authorRows, genreRows, nationalities, publisherRows, languageRows, yearRows] =
      await Promise.all([
        prisma.author.findMany({
          where: { books: { some: {} } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, nationality: true, _count: { select: { books: true } } },
        }),
        prisma.genre.findMany({
          where: { books: { some: {} } },
          select: { id: true, name: true, _count: { select: { books: true } } },
        }),
        prisma.$queryRaw<NationalityRow[]>`
          select a.nationality as value, count(distinct ba.book_id)::int as "bookCount"
          from author a
          join book_author ba on ba.author_id = a.id
          where a.nationality is not null
          group by a.nationality
          order by count(distinct ba.book_id) desc, lower(a.nationality)
        `,
        prisma.book.groupBy({
          by: ['publisher'],
          where: { publisher: { not: null } },
          _count: { _all: true },
        }),
        prisma.book.groupBy({
          by: ['language'],
          where: { language: { not: null } },
          _count: { _all: true },
        }),
        prisma.book.groupBy({
          by: ['publishedYear'],
          where: { publishedYear: { not: null } },
          _count: { _all: true },
        }),
      ])

    const byCountThenName = (a: { value: string; bookCount: number }, b: typeof a) =>
      b.bookCount - a.bookCount || a.value.localeCompare(b.value)

    return {
      authors: authorRows.map((row) => ({
        id: row.id,
        name: row.name,
        nationality: row.nationality,
        bookCount: row._count.books,
      })),
      genres: genreRows
        .map((row) => ({ id: row.id, name: row.name, bookCount: row._count.books }))
        .sort((a, b) => b.bookCount - a.bookCount || a.name.localeCompare(b.name)),
      nationalities,
      publishers: publisherRows
        .map((row) => ({ value: row.publisher as string, bookCount: row._count._all }))
        .sort(byCountThenName),
      languages: languageRows
        .map((row) => ({ value: row.language as string, bookCount: row._count._all }))
        .sort(byCountThenName),
      years: yearRows
        .map((row) => ({ value: row.publishedYear as number, bookCount: row._count._all }))
        .sort((a, b) => b.value - a.value),
    }
  })

  router.get('/api/stats', async () => {
    const owned = { location: 'owned' } as const

    const [
      booksOwned,
      wishlist,
      finished,
      reading,
      aside,
      unread,
      pages,
      overall,
      authors,
      genres,
      notes,
      collections,
      booksWithNotes,
    ] = await prisma.$transaction([
      prisma.book.count({ where: owned }),
      prisma.book.count({ where: { location: 'wishlist' } }),
      prisma.book.count({ where: { ...owned, readingStatus: 'finished' } }),
      prisma.book.count({ where: { ...owned, readingStatus: 'reading' } }),
      prisma.book.count({ where: { ...owned, readingStatus: 'aside' } }),
      prisma.book.count({ where: { ...owned, readingStatus: 'unread' } }),
      prisma.book.aggregate({
        where: { ...owned, readingStatus: 'finished' },
        _sum: { pageCount: true },
      }),
      prisma.book.aggregate({ _avg: { rating: true }, _max: { createdAt: true } }),
      prisma.author.count(),
      prisma.genre.count(),
      prisma.note.count(),
      prisma.shelf.count({ where: { kind: 'manual' } }),
      prisma.book.count({ where: { notes: { some: {} } } }),
    ])

    const average = overall._avg.rating

    return {
      booksOwned,
      wishlist,
      finished,
      reading,
      aside,
      unread,
      pagesRead: pages._sum.pageCount ?? 0,
      averageRating: average === null ? null : Math.round(average * 100) / 100,
      lastShelved: overall._max.createdAt,
      authors,
      genres,
      notes,
      collections,
      booksWithNotes,
    }
  })
}
