import { BookLocation, NoteKind, ReadingStatus } from './generated/prisma/enums.ts'

export const READING_STATUSES = Object.values(ReadingStatus)
export const LOCATIONS = Object.values(BookLocation)
export const NOTE_KINDS = Object.values(NoteKind)

export type { BookLocation, NoteKind, ReadingStatus }

const PALETTE = [
  '#7C3B2E',
  '#3F5A4B',
  '#2E4159',
  '#8A6A2F',
  '#5B3A54',
  '#6E4630',
  '#334B44',
  '#4A4E6B',
  '#8C5A3C',
  '#2F3E33',
  '#6B2F35',
  '#4C5C2E',
]

export type SpineSource = {
  id: number
  spineColor?: string | null
  spineWidth?: number | null
  spineHeight?: number | null
  pageCount?: number | null
}

export function resolveSpine(book: SpineSource) {
  const seed = book.id

  const width =
    book.spineWidth ??
    (book.pageCount ? Math.max(22, Math.min(46, Math.round(18 + book.pageCount / 26))) : 26 + ((seed * 13) % 16))

  return {
    spineColor: book.spineColor ?? (PALETTE[seed % PALETTE.length] as string),
    spineWidth: width,
    spineHeight: book.spineHeight ?? 138 + ((seed * 37) % 58),
    spineAuto: book.spineColor == null,
  }
}
