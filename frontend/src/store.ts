import type { Facet, ReadingStatus } from './types.ts'

export type View = 'room' | 'wishlist' | 'notes' | 'search'

export type Filters = {
  authorId?: number
  genreId?: number
  nationality?: string
  publisher?: string
  language?: string
  year?: number
  minRating?: number
}

export type State = {
  view: View
  collection: number | null
  book: number | null
  q: string
  status: 'all' | ReadingStatus
  facet: Facet
  filters: Filters
}

const VIEWS: View[] = ['room', 'wishlist', 'notes', 'search']
const STATUSES = ['all', 'unread', 'reading', 'finished', 'aside']
const FACETS: Facet[] = ['books', 'notes', 'wishlist', 'authors']

const NUMERIC_FILTERS = ['authorId', 'genreId', 'year', 'minRating'] as const
const TEXT_FILTERS = ['nationality', 'publisher', 'language'] as const

function parse(): State {
  const hash = window.location.hash.replace(/^#/, '')
  const [path, search] = hash.split('?')
  const params = new URLSearchParams(search ?? '')
  const view = (path ?? '').replace(/^\//, '') as View

  const filters: Filters = {}
  for (const key of NUMERIC_FILTERS) {
    const raw = Number(params.get(key))
    if (Number.isInteger(raw) && raw > 0) filters[key] = raw
  }
  for (const key of TEXT_FILTERS) {
    const raw = params.get(key)?.trim()
    if (raw) filters[key] = raw
  }

  const status = params.get('status') ?? 'all'
  const facet = params.get('facet') ?? 'books'
  const collection = Number(params.get('collection'))
  const book = Number(params.get('book'))

  return {
    view: VIEWS.includes(view) ? view : 'room',
    collection: Number.isInteger(collection) && collection > 0 ? collection : null,
    book: Number.isInteger(book) && book > 0 ? book : null,
    q: params.get('q') ?? '',
    status: (STATUSES.includes(status) ? status : 'all') as State['status'],
    facet: (FACETS.includes(facet as Facet) ? facet : 'books') as Facet,
    filters,
  }
}

function serialise(state: State): string {
  const params = new URLSearchParams()
  if (state.collection) params.set('collection', String(state.collection))
  if (state.book) params.set('book', String(state.book))
  if (state.q) params.set('q', state.q)
  if (state.status !== 'all') params.set('status', state.status)
  if (state.view === 'search' && state.facet !== 'books') params.set('facet', state.facet)
  for (const [key, value] of Object.entries(state.filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const query = params.toString()
  return `#/${state.view}${query ? `?${query}` : ''}`
}

let state = parse()
const listeners = new Set<(next: State, previous: State) => void>()

export function getState(): State {
  return state
}

export function subscribe(listener: (next: State, previous: State) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit(previous: State): void {
  for (const listener of listeners) listener(state, previous)
}

export function setState(patch: Partial<State>, push = false): void {
  const previous = state
  state = { ...state, ...patch }

  const url = serialise(state)
  if (push) window.location.hash = url.slice(1)
  else window.history.replaceState(null, '', url)

  emit(previous)
}

export function setFilters(patch: Filters): void {
  const filters = { ...state.filters, ...patch }
  for (const key of Object.keys(filters) as (keyof Filters)[]) {
    if (filters[key] === undefined || filters[key] === '') delete filters[key]
  }
  setState({ filters })
}

export function clearFilters(): void {
  setState({ filters: {}, q: '', status: 'all' })
}

export function activeFilterCount(value: State = state): number {
  return Object.keys(value.filters).length + (value.status === 'all' ? 0 : 1)
}

export function hasRoomFilter(value: State = state): boolean {
  return Boolean(value.q) || activeFilterCount(value) > 0
}

window.addEventListener('hashchange', () => {
  const next = parse()
  if (serialise(next) === serialise(state)) return
  const previous = state
  state = next
  emit(previous)
})

export function startState(): void {
  if (!window.location.hash) {
    window.history.replaceState(null, '', serialise(state))
  }
}
