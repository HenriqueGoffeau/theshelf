import type { Prisma } from './generated/prisma/client.ts'
import { resolveSpine } from './spine.ts'
import type { BookLocation, ReadingStatus, SpineInk } from './spine.ts'

export const spineSelect = {
  id: true,
  title: true,
  publishedYear: true,
  readingStatus: true,
  location: true,
  rating: true,
  coverUrl: true,
  pageCount: true,
  spineColor: true,
  spineInk: true,
  spineWidth: true,
  spineHeight: true,
  authors: {
    select: { author: { select: { name: true } } },
    orderBy: { position: 'asc' },
    take: 1,
  },
} satisfies Prisma.BookSelect

export const bookSelect = {
  id: true,
  title: true,
  publishedYear: true,
  readingStatus: true,
  location: true,
  rating: true,
  coverUrl: true,
  pageCount: true,
  spineColor: true,
  spineInk: true,
  spineWidth: true,
  spineHeight: true,
  isbn13: true,
  isbn10: true,
  subtitle: true,
  publisher: true,
  language: true,
  description: true,
  source: true,
  wishReason: true,
  acquiredOn: true,
  createdAt: true,
  updatedAt: true,
  authors: {
    select: { author: { select: { id: true, name: true, nationality: true } } },
    orderBy: [{ position: 'asc' }, { author: { name: 'asc' } }],
  },
  genres: {
    select: { genre: { select: { id: true, name: true } } },
    orderBy: { genre: { name: 'asc' } },
  },
  shelves: {
    where: { shelf: { kind: 'manual' } },
    select: { shelf: { select: { id: true, name: true } } },
    orderBy: [{ shelf: { position: 'asc' } }, { shelf: { name: 'asc' } }],
  },
  _count: { select: { notes: true } },
} satisfies Prisma.BookSelect

export type SpineRow = {
  id: number
  title: string
  publishedYear: number | null
  readingStatus: ReadingStatus
  location: BookLocation
  rating: number | null
  coverUrl: string | null
  pageCount: number | null
  spineColor: string | null
  spineInk: SpineInk | null
  spineWidth: number | null
  spineHeight: number | null
  authors: { author: { name: string } }[]
}

export type BookRow = SpineRow & {
  isbn13: string | null
  isbn10: string | null
  subtitle: string | null
  publisher: string | null
  language: string | null
  description: string | null
  source: string
  wishReason: string | null
  acquiredOn: Date | null
  createdAt: Date
  updatedAt: Date
  authors: { author: { id: number; name: string; nationality: string | null } }[]
  genres: { genre: { id: number; name: string } }[]
  shelves: { shelf: { id: number; name: string } }[]
  _count: { notes: number }
}

export function toDateOnly(value: Date | null): string | null {
  return value === null ? null : value.toISOString().slice(0, 10)
}

export function fromDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

export function toSpine(book: SpineRow) {
  return {
    id: book.id,
    title: book.title,
    author: book.authors[0]?.author.name ?? '',
    publishedYear: book.publishedYear,
    readingStatus: book.readingStatus,
    location: book.location,
    rating: book.rating,
    coverUrl: book.coverUrl,
    pageCount: book.pageCount,
    ...resolveSpine(book),
  }
}

export function toSpines(books: SpineRow[]) {
  return books.map(toSpine)
}

export function toBook(book: BookRow) {
  return {
    ...toSpine(book),
    isbn13: book.isbn13,
    isbn10: book.isbn10,
    subtitle: book.subtitle,
    publisher: book.publisher,
    language: book.language,
    description: book.description,
    source: book.source,
    wishReason: book.wishReason,
    acquiredOn: toDateOnly(book.acquiredOn),
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    authors: book.authors.map((entry) => entry.author),
    genres: book.genres.map((entry) => entry.genre),
    shelves: book.shelves.map((entry) => entry.shelf),
    noteCount: book._count.notes,
  }
}
