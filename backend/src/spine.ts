import { BookLocation, NoteKind, ReadingStatus, SpineInk } from './generated/prisma/enums.ts'

export const READING_STATUSES = Object.values(ReadingStatus)
export const LOCATIONS = Object.values(BookLocation)
export const NOTE_KINDS = Object.values(NoteKind)
export const SPINE_INKS = Object.values(SpineInk)

export type { BookLocation, NoteKind, ReadingStatus, SpineInk }

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

type Rgb = [number, number, number]

const INK_LIGHT: Rgb = [239, 230, 214]
const INK_DARK: Rgb = [28, 20, 15]
const MIN_CONTRAST = 4.5

function parseHex(value: string): Rgb | null {
  const hex = value.trim().replace(/^#/, '')
  const full = hex.length === 3 ? hex.replace(/./g, (char) => char + char) : hex
  if (!/^[0-9a-f]{6}$/i.test(full)) return null
  return [0, 2, 4].map((at) => Number.parseInt(full.slice(at, at + 2), 16)) as Rgb
}

function luminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const unit = value / 255
    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a: number, b: number): number {
  return a > b ? (a + 0.05) / (b + 0.05) : (b + 0.05) / (a + 0.05)
}

export function inkFor(spineColor: string): SpineInk {
  const rgb = parseHex(spineColor)
  if (!rgb) return 'light'

  const behind = luminance(rgb)
  const onLight = contrast(behind, luminance(INK_LIGHT))
  if (onLight >= MIN_CONTRAST) return 'light'
  return contrast(behind, luminance(INK_DARK)) > onLight ? 'dark' : 'light'
}

export type SpineSource = {
  id: number
  spineColor?: string | null
  spineInk?: SpineInk | null
  spineWidth?: number | null
  spineHeight?: number | null
  pageCount?: number | null
}

export function resolveSpine(book: SpineSource) {
  const seed = book.id

  const width =
    book.spineWidth ??
    (book.pageCount ? Math.max(22, Math.min(46, Math.round(18 + book.pageCount / 26))) : 26 + ((seed * 13) % 16))

  const spineColor = book.spineColor ?? (PALETTE[seed % PALETTE.length] as string)

  return {
    spineColor,
    spineWidth: width,
    spineHeight: book.spineHeight ?? 138 + ((seed * 37) % 58),
    spineAuto: book.spineColor == null,
    spineInk: book.spineInk ?? inkFor(spineColor),
  }
}
