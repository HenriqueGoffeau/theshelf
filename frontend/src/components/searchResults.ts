import { el } from '../dom.ts'
import { STATUS_LABEL, STATUS_VAR, noteMeta, stars } from '../format.ts'
import type { Author, Facet, Note, SearchCounts, Spine } from '../types.ts'

export const FACET_LABELS: Record<Facet, string> = {
  books: 'Books',
  notes: 'Notes',
  wishlist: 'Wishlist',
  authors: 'Authors',
}

export function facetChips(
  active: Facet,
  counts: SearchCounts,
  onPick: (facet: Facet) => void,
): HTMLElement[] {
  return (Object.keys(FACET_LABELS) as Facet[]).map((facet) =>
    el(
      'button',
      {
        class: `chip${facet === active ? ' is-on' : ''}`,
        type: 'button',
        onclick: () => onPick(facet),
      },
      el('span', { text: FACET_LABELS[facet] }),
      el('span', { class: 'chip-count', text: String(counts[facet] ?? 0) }),
    ),
  )
}

export function resultSummary(term: string, counts: SearchCounts): string {
  const parts: string[] = []
  if (counts.books) parts.push(`${counts.books} book${counts.books === 1 ? '' : 's'}`)
  if (counts.notes) parts.push(`${counts.notes} note${counts.notes === 1 ? '' : 's'}`)
  if (counts.wishlist) parts.push(`${counts.wishlist} wished`)
  if (counts.authors) parts.push(`${counts.authors} author${counts.authors === 1 ? '' : 's'}`)
  if (parts.length === 0) return `nothing matches “${term}”`
  return `${parts.join(' · ')} mention “${term}”`
}

function bookRow(spine: Spine, onPick: (id: number) => void): HTMLElement {
  return el(
    'button',
    { class: 'result-row', type: 'button', onclick: () => onPick(spine.id) },
    el('span', { class: 'result-spine', style: { '--bg': spine.spineColor } as Record<string, string> }),
    el(
      'span',
      { class: 'grow', style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
      el('span', { class: 'result-title', text: spine.title }),
      el('span', {
        class: 'result-sub',
        text: [spine.author, spine.publishedYear].filter(Boolean).join(' · '),
      }),
      spine.shelfName ? el('span', { class: 'mono', text: spine.shelfName }) : null,
    ),
    el(
      'span',
      { class: 'result-side' },
      el('span', { style: { color: 'var(--accent)', fontSize: '14px' }, text: stars(spine.rating) }),
      el(
        'span',
        { class: 'row', style: { gap: '6px', fontSize: '13px', color: 'var(--ink-55)' } },
        el('span', {
          class: 'chip-dot',
          style: { '--dot': STATUS_VAR[spine.readingStatus] } as Record<string, string>,
        }),
        el('span', { text: STATUS_LABEL[spine.readingStatus] }),
      ),
    ),
  )
}

function noteRow(note: Note, onPick: (id: number) => void): HTMLElement {
  return el(
    'button',
    { class: 'result-row', type: 'button', onclick: () => onPick(note.bookId) },
    el('span', { class: 'result-spine', style: { '--bg': note.spineColor } as Record<string, string> }),
    el(
      'span',
      { class: 'grow', style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
      el(
        'span',
        { class: 'row', style: { gap: '10px', flexWrap: 'wrap' } },
        el('span', { class: 'result-title', style: { fontSize: '17px' }, text: note.bookTitle }),
        el('span', { class: 'note-meta', text: noteMeta(note) }),
      ),
      el('span', { class: 'note-text', style: { fontSize: '14px' }, text: note.text }),
    ),
  )
}

function authorRow(author: Author, onPick: (id: number) => void): HTMLElement {
  return el(
    'button',
    { class: 'result-row', type: 'button', onclick: () => onPick(author.id) },
    el(
      'span',
      { class: 'grow', style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
      el('span', { class: 'result-title', text: author.name }),
      el('span', {
        class: 'result-sub',
        text: [author.nationality, `${author.bookCount} on the shelf`].filter(Boolean).join(' · '),
      }),
    ),
  )
}

type Handlers = {
  onBook: (id: number) => void
  onAuthor: (id: number) => void
}

export function resultRows(facet: Facet, items: unknown[], handlers: Handlers): HTMLElement[] {
  if (facet === 'notes') {
    return (items as Note[]).map((note) => noteRow(note, handlers.onBook))
  }
  if (facet === 'authors') {
    return (items as Author[]).map((author) => authorRow(author, handlers.onAuthor))
  }
  return (items as Spine[]).map((spine) => bookRow(spine, handlers.onBook))
}
