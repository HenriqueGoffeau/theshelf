import { api } from '../api.ts'
import { el, mount } from '../dom.ts'
import { STATUS_LABEL, STATUS_ORDER, STATUS_VAR } from '../format.ts'
import { activeFilterCount, clearFilters, getState, setFilters, setState } from '../store.ts'
import { toastError } from '../toast.ts'
import type { Facets, ReadingStatus } from '../types.ts'
import { openOverlay } from './overlay.ts'

let cached: Facets | null = null

export async function loadFacets(): Promise<Facets> {
  if (!cached) cached = await api.facets()
  return cached
}

export function invalidateFacets(): void {
  cached = null
}

function group(
  title: string,
  entries: { id: string | number; label: string; count?: number; dot?: string }[],
  active: string | number | undefined,
  onPick: (value: string | number | undefined) => void,
): HTMLElement | null {
  if (entries.length === 0) return null

  return el(
    'section',
    { class: 'facet-group' },
    el('span', { class: 'label', text: title }),
    el(
      'div',
      { class: 'facet-options' },
      entries.map((entry) =>
        el(
          'button',
          {
            class: `chip${String(active) === String(entry.id) ? ' is-on' : ''}`,
            type: 'button',
            onclick: () => onPick(String(active) === String(entry.id) ? undefined : entry.id),
          },
          entry.dot
            ? el('span', { class: 'chip-dot', style: { '--dot': entry.dot } as Record<string, string> })
            : null,
          el('span', { text: entry.label }),
          entry.count === undefined ? null : el('span', { class: 'chip-count', text: String(entry.count) }),
        ),
      ),
    ),
  )
}

export function openFilterDrawer(onApplied: () => void, mobile = false): void {
  const body = el('div', { class: 'drawer-body' })
  const countLabel = el('span', { class: 'mono' })

  const paint = (facets: Facets) => {
    const state = getState()
    const filters = state.filters

    const repaint = () => {
      countLabel.textContent = `${activeFilterCount()} active`
      paint(facets)
      onApplied()
    }

    countLabel.textContent = `${activeFilterCount()} active`

    mount(
      body,
      group(
        'reading',
        STATUS_ORDER.map((status) => ({
          id: status,
          label: STATUS_LABEL[status],
          dot: STATUS_VAR[status],
        })),
        state.status === 'all' ? undefined : state.status,
        (value) => {
          setState({ status: (value as ReadingStatus) ?? 'all' })
          repaint()
        },
      ),
      group(
        'rating',
        [
          { id: 5, label: '★★★★★' },
          { id: 4, label: '★★★★ and up' },
          { id: 3, label: '★★★ and up' },
        ],
        filters.minRating,
        (value) => {
          setFilters({ minRating: value as number | undefined })
          repaint()
        },
      ),
      group(
        'genre',
        facets.genres.map((genre) => ({ id: genre.id, label: genre.name, count: genre.bookCount })),
        filters.genreId,
        (value) => {
          setFilters({ genreId: value as number | undefined })
          repaint()
        },
      ),
      group(
        'author',
        facets.authors.map((author) => ({ id: author.id, label: author.name, count: author.bookCount })),
        filters.authorId,
        (value) => {
          setFilters({ authorId: value as number | undefined })
          repaint()
        },
      ),
      facets.nationalities.length > 0
        ? group(
            'nationality',
            facets.nationalities.map((entry) => ({
              id: entry.value,
              label: entry.value,
              count: entry.bookCount,
            })),
            filters.nationality,
            (value) => {
              setFilters({ nationality: value as string | undefined })
              repaint()
            },
          )
        : el(
            'p',
            { class: 'empty' },
            'Nationality comes from your authors — no catalogue supplies it. Fill one in on a book and it appears here.',
          ),
      group(
        'publisher',
        facets.publishers.slice(0, 40).map((entry) => ({
          id: entry.value,
          label: entry.value,
          count: entry.bookCount,
        })),
        filters.publisher,
        (value) => {
          setFilters({ publisher: value as string | undefined })
          repaint()
        },
      ),
      group(
        'language',
        facets.languages.map((entry) => ({
          id: entry.value,
          label: entry.value,
          count: entry.bookCount,
        })),
        filters.language,
        (value) => {
          setFilters({ language: value as string | undefined })
          repaint()
        },
      ),
      group(
        'year',
        facets.years.slice(0, 60).map((entry) => ({
          id: entry.value,
          label: String(entry.value),
          count: entry.bookCount,
        })),
        filters.year,
        (value) => {
          setFilters({ year: value as number | undefined })
          repaint()
        },
      ),
    )
  }

  openOverlay({
    className: mobile ? 'm-full-sheet' : 'drawer',
    content: (close) =>
      el(
        'div',
        { class: mobile ? 'm-full-sheet' : 'drawer' },
        el(
          'div',
          { class: 'drawer-head' },
          el('h2', { class: 'display', style: { fontSize: '22px' }, text: 'Narrow the room' }),
          el('button', { class: 'btn btn-quiet', type: 'button', text: '✕', onclick: close }),
        ),
        body,
        el(
          'div',
          { class: 'drawer-foot' },
          countLabel,
          el(
            'div',
            { class: 'row', style: { gap: '10px' } },
            el('button', {
              class: 'btn',
              type: 'button',
              text: 'Clear all',
              onclick: () => {
                clearFilters()
                onApplied()
                close()
              },
            }),
            el('button', { class: 'btn btn-accent', type: 'button', text: 'Done', onclick: close }),
          ),
        ),
      ),
  })

  mount(body, el('div', { class: 'loading' }, el('span', { class: 'spinner' }), 'Reading the index…'))
  void loadFacets().then(paint).catch(toastError)
}
