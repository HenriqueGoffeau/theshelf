import type { Note, ReadingStatus, Spine } from './types.ts'

export const STATUS_LABEL: Record<ReadingStatus, string> = {
  unread: 'Unread',
  reading: 'Reading',
  finished: 'Finished',
  aside: 'Set aside',
}

export const STATUS_VAR: Record<ReadingStatus, string> = {
  unread: 'var(--status-unread)',
  reading: 'var(--status-reading)',
  finished: 'var(--status-finished)',
  aside: 'var(--status-aside)',
}

export const STATUS_ORDER: ReadingStatus[] = ['reading', 'finished', 'aside', 'unread']

export function byline(book: { author?: string; publishedYear?: number | null }): string {
  return [book.author || 'Author unknown', book.publishedYear ?? null].filter(Boolean).join(' · ')
}

export function shortDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const day = String(date.getDate()).padStart(2, '0')
  const month = date.toLocaleString('en', { month: 'short' }).toUpperCase()
  return `${day} ${month} ${date.getFullYear()}`
}

export function isToday(value: string): boolean {
  const date = new Date(value)
  const now = new Date()
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  )
}

export function noteMeta(note: Note): string {
  const when = isToday(note.createdAt) ? 'TODAY' : shortDate(note.createdAt)
  if (note.kind === 'finished') return `FINISHED · ${when}`
  if (note.kind === 'started') return `STARTED · ${when}`
  if (note.kind === 'review') return `REVIEW · ${when}`
  return note.page ? `P. ${note.page} · ${when}` : when
}

export function plural(count: number, singular: string, many = `${singular}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? singular : many}`
}

export function volumeCount(total: number): string {
  return `${total.toLocaleString()} ${total === 1 ? 'volume' : 'volumes'}`
}

export function stars(rating: number | null): string {
  return rating ? '★'.repeat(rating) : '—'
}

export function spineVars(spine: Spine): Record<string, string> {
  return {
    '--w': `${spine.spineWidth}px`,
    '--h': `${spine.spineHeight}px`,
    '--bg': spine.spineColor,
  }
}

export function searchShortcut(): string {
  const platform = navigator.platform ?? ''
  return /Mac|iPhone|iPad/i.test(platform) ? '⌘ K' : 'Ctrl K'
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('') || 'ME'
}
