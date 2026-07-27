export type BookDraft = {
  isbn13: string | null
  isbn10: string | null
  title: string
  subtitle: string | null
  authors: string[]
  publisher: string | null
  publishedYear: number | null
  pageCount: number | null
  language: string | null
  description: string | null
  coverUrl: string | null
  genres: string[]
}

export type LookupResult = {
  found: boolean
  sources: string[]
  book: BookDraft | null
  existingBookId: number | null
}

export function emptyDraft(): BookDraft {
  return {
    isbn13: null,
    isbn10: null,
    title: '',
    subtitle: null,
    authors: [],
    publisher: null,
    publishedYear: null,
    pageCount: null,
    language: null,
    description: null,
    coverUrl: null,
    genres: [],
  }
}
