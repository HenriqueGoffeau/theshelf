import { config } from '../config.ts'
import { languageName } from '../languages.ts'
import { splitIsbns } from '../isbn.ts'
import type { BookDraft } from '../types.ts'
import { cleanText, fetchJson, firstYear, longText, positiveInt, tidyGenres } from './util.ts'

type VolumesResponse = {
  totalItems?: number
  items?: {
    volumeInfo?: {
      title?: string
      subtitle?: string
      authors?: string[]
      publisher?: string
      publishedDate?: string
      description?: string
      pageCount?: number
      categories?: string[]
      language?: string
      imageLinks?: Record<string, string>
    }
  }[]
}

function bestCover(links: Record<string, string> | undefined): string | null {
  if (!links) return null
  const preference = ['extraLarge', 'large', 'medium', 'small', 'thumbnail', 'smallThumbnail']
  for (const key of preference) {
    const url = links[key]
    if (!url) continue
    return url.replace(/^http:/, 'https:').replace(/&edge=curl/, '')
  }
  return null
}

export async function lookupGoogleBooks(isbn: string): Promise<BookDraft | null> {
  const key = config.googleBooksApiKey ? `&key=${config.googleBooksApiKey}` : ''
  const response = await fetchJson<VolumesResponse>(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1${key}`,
  )

  const info = response?.items?.[0]?.volumeInfo
  const title = cleanText(info?.title)
  if (!title) return null

  const { isbn13, isbn10 } = splitIsbns(isbn)

  return {
    isbn13,
    isbn10,
    title,
    subtitle: cleanText(info?.subtitle),
    authors: (info?.authors ?? [])
      .map((author) => cleanText(author))
      .filter((name): name is string => Boolean(name)),
    publisher: cleanText(info?.publisher),
    publishedYear: firstYear(info?.publishedDate),
    pageCount: positiveInt(info?.pageCount),
    language: languageName(info?.language),
    description: longText(info?.description),
    coverUrl: bestCover(info?.imageLinks),
    genres: tidyGenres(info?.categories),
  }
}
