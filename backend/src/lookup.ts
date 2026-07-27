import { lookupGoogleBooks } from './providers/googlebooks.ts'
import { lookupOpenLibrary } from './providers/openlibrary.ts'
import type { BookDraft } from './types.ts'

function mergeGenres(primary: string[], secondary: string[], limit = 10): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const genre of [...primary, ...secondary]) {
    const key = genre.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(genre)
    if (out.length >= limit) break
  }
  return out
}

function merge(primary: BookDraft, secondary: BookDraft): BookDraft {
  return {
    isbn13: primary.isbn13 ?? secondary.isbn13,
    isbn10: primary.isbn10 ?? secondary.isbn10,
    title: primary.title || secondary.title,
    subtitle: primary.subtitle ?? secondary.subtitle,
    authors: primary.authors.length > 0 ? primary.authors : secondary.authors,
    publisher: primary.publisher ?? secondary.publisher,
    publishedYear: primary.publishedYear ?? secondary.publishedYear,
    pageCount: primary.pageCount ?? secondary.pageCount,
    language: primary.language ?? secondary.language,
    description: primary.description ?? secondary.description,
    coverUrl: primary.coverUrl ?? secondary.coverUrl,
    genres: mergeGenres(primary.genres, secondary.genres),
  }
}

export async function lookupIsbn(
  isbn: string,
): Promise<{ book: BookDraft | null; sources: string[] }> {
  const [openLibrary, google] = await Promise.all([
    lookupOpenLibrary(isbn),
    lookupGoogleBooks(isbn),
  ])

  const sources: string[] = []
  if (openLibrary) sources.push('openlibrary')
  if (google) sources.push('googlebooks')

  if (openLibrary && google) return { book: merge(openLibrary, google), sources }
  return { book: openLibrary ?? google, sources }
}
