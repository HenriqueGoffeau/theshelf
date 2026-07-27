import { config } from '../config.ts'
import { languageName } from '../languages.ts'
import { splitIsbns } from '../isbn.ts'
import type { BookDraft } from '../types.ts'
import { cleanText, fetchJson, firstYear, longText, positiveInt, tidyGenres } from './util.ts'

type OpenLibrarySearch = {
  docs?: {
    title?: string
    subtitle?: string
    author_name?: string[]
    first_publish_year?: number
    publisher?: string[]
    isbn?: string[]
    cover_i?: number
    language?: string[]
    number_of_pages_median?: number
    subject?: string[]
  }[]
}

type GoogleSearch = {
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
      industryIdentifiers?: { type?: string; identifier?: string }[]
    }
  }[]
}

function pickIsbn(candidates: string[] | undefined): { isbn13: string | null; isbn10: string | null } {
  for (const raw of candidates ?? []) {
    const split = splitIsbns(raw.replace(/[\s-]/g, '').toUpperCase())
    if (split.isbn13) return split
  }
  return { isbn13: null, isbn10: null }
}

const OL_FIELDS =
  'title,subtitle,author_name,first_publish_year,publisher,isbn,cover_i,language,number_of_pages_median,subject'

async function fromOpenLibrary(term: string): Promise<BookDraft[]> {
  const search = (param: 'title' | 'q') =>
    fetchJson<OpenLibrarySearch>(
      `https://openlibrary.org/search.json?${param}=${encodeURIComponent(term)}&limit=12&fields=${OL_FIELDS}`,
    )

  let response = await search('title')
  if (!response?.docs?.length) response = await search('q')

  return (response?.docs ?? [])
    .map((doc): BookDraft | null => {
      const title = cleanText(doc.title)
      if (!title) return null
      const { isbn13, isbn10 } = pickIsbn(doc.isbn)

      return {
        isbn13,
        isbn10,
        title,
        subtitle: cleanText(doc.subtitle),
        authors: (doc.author_name ?? []).slice(0, 3).map((name) => cleanText(name) ?? '').filter(Boolean),
        publisher: cleanText(doc.publisher?.[0]),
        publishedYear: firstYear(doc.first_publish_year),
        pageCount: positiveInt(doc.number_of_pages_median),
        language: languageName(doc.language?.[0]),
        description: null,
        coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
        genres: tidyGenres(doc.subject, 5),
      }
    })
    .filter((entry): entry is BookDraft => entry !== null)
}

async function fromGoogle(term: string): Promise<BookDraft[]> {
  const key = config.googleBooksApiKey ? `&key=${config.googleBooksApiKey}` : ''
  const response = await fetchJson<GoogleSearch>(
    `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(term)}&maxResults=10${key}`,
  )

  return (response?.items ?? [])
    .map((item): BookDraft | null => {
      const info = item.volumeInfo
      const title = cleanText(info?.title)
      if (!title) return null

      const identifiers = (info?.industryIdentifiers ?? [])
        .map((entry) => entry.identifier)
        .filter((entry): entry is string => Boolean(entry))
      const { isbn13, isbn10 } = pickIsbn(identifiers)

      const links = info?.imageLinks
      const cover = links?.large ?? links?.medium ?? links?.thumbnail ?? links?.smallThumbnail ?? null

      return {
        isbn13,
        isbn10,
        title,
        subtitle: cleanText(info?.subtitle),
        authors: (info?.authors ?? []).slice(0, 3).map((name) => cleanText(name) ?? '').filter(Boolean),
        publisher: cleanText(info?.publisher),
        publishedYear: firstYear(info?.publishedDate),
        pageCount: positiveInt(info?.pageCount),
        language: languageName(info?.language),
        description: longText(info?.description),
        coverUrl: cover ? cover.replace(/^http:/, 'https:').replace(/&edge=curl/, '') : null,
        genres: tidyGenres(info?.categories, 5),
      }
    })
    .filter((entry): entry is BookDraft => entry !== null)
}

const COMPANION =
  /\b(summary|summaries|study guide|studyguide|sparknotes|cliffs?notes|bookclub-in-a-box|discusses|analysis of|a guide to|guide to the|workbook|quicklet|conversation starters|collection set|boxed set|box set|instaread|shmoop|abridged)\b/i

function score(entry: BookDraft, term: string): number {
  const title = entry.title.toLowerCase()
  const wanted = term.toLowerCase().trim()
  let value = 0

  if (title === wanted) value += 100
  else if (title.startsWith(wanted)) value += 60
  else if (title.includes(wanted)) value += 30

  if (COMPANION.test(entry.title)) value -= 120
  if (entry.authors.length > 0) value += 8
  if (entry.coverUrl) value += 6
  if (entry.isbn13) value += 4
  if (entry.publishedYear) value += 2
  value -= Math.min(20, Math.max(0, entry.title.length - wanted.length) / 4)

  return value
}

export async function searchByTitle(term: string): Promise<{ results: BookDraft[]; sources: string[] }> {
  const [openLibrary, google] = await Promise.all([fromOpenLibrary(term), fromGoogle(term)])

  const sources: string[] = []
  if (openLibrary.length > 0) sources.push('openlibrary')
  if (google.length > 0) sources.push('googlebooks')

  const seen = new Set<string>()
  const results: BookDraft[] = []

  for (const entry of [...openLibrary, ...google]) {
    const key = entry.isbn13 ?? `${entry.title.toLowerCase()}|${entry.authors[0]?.toLowerCase() ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    results.push(entry)
  }

  return {
    results: results.sort((a, b) => score(b, term) - score(a, term)).slice(0, 15),
    sources,
  }
}
