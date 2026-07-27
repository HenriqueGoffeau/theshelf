import { languageName } from '../languages.ts'
import { splitIsbns } from '../isbn.ts'
import type { BookDraft } from '../types.ts'
import { cleanText, fetchJson, firstYear, longText, positiveInt, tidyGenres } from './util.ts'

type DataResponse = Record<
  string,
  {
    title?: string
    subtitle?: string
    authors?: { name?: string; url?: string }[]
    publishers?: { name?: string }[]
    publish_date?: string
    number_of_pages?: number
    cover?: { small?: string; medium?: string; large?: string }
    subjects?: { name?: string }[]
  }
>

type EditionResponse = {
  languages?: { key?: string }[]
  description?: string | { value?: string }
  works?: { key?: string }[]
  subjects?: string[]
}

type WorkResponse = {
  description?: string | { value?: string }
  subjects?: string[]
}

function unwrapDescription(value: unknown): string | null {
  if (typeof value === 'string') return longText(value)
  if (value && typeof value === 'object' && 'value' in value) {
    return longText((value as { value?: unknown }).value)
  }
  return null
}

export async function lookupOpenLibrary(isbn: string): Promise<BookDraft | null> {
  const [data, edition] = await Promise.all([
    fetchJson<DataResponse>(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
    ),
    fetchJson<EditionResponse>(`https://openlibrary.org/isbn/${isbn}.json`),
  ])

  const record = data?.[`ISBN:${isbn}`]
  const title = cleanText(record?.title)
  if (!title) return null

  let description = unwrapDescription(edition?.description)
  let subjects: unknown = record?.subjects ?? edition?.subjects

  const workKey = edition?.works?.[0]?.key
  if (workKey && (!description || !subjects)) {
    const work = await fetchJson<WorkResponse>(`https://openlibrary.org${workKey}.json`)
    description = description ?? unwrapDescription(work?.description)
    subjects = subjects ?? work?.subjects
  }

  const languageKey = edition?.languages?.[0]?.key?.replace('/languages/', '')
  const { isbn13, isbn10 } = splitIsbns(isbn)

  return {
    isbn13,
    isbn10,
    title,
    subtitle: cleanText(record?.subtitle),
    authors: (record?.authors ?? [])
      .map((author) => cleanText(author?.name))
      .filter((name): name is string => Boolean(name)),
    publisher: cleanText(record?.publishers?.[0]?.name),
    publishedYear: firstYear(record?.publish_date),
    pageCount: positiveInt(record?.number_of_pages),
    language: languageName(languageKey),
    description,
    coverUrl: cleanText(record?.cover?.large ?? record?.cover?.medium),
    genres: tidyGenres(subjects),
  }
}
