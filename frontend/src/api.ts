import type {
  Author,
  Book,
  BookDraft,
  BookLocation,
  BookPage,
  BookPayload,
  Facets,
  Genre,
  Note,
  NoteFeed,
  Room,
  SearchResult,
  Shelf,
  ShelfRow,
  Spine,
  Stats,
} from './types.ts'

export class ApiError extends Error {
  status: number
  details: unknown

  constructor(status: number, message: string, details: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export const UNAUTHENTICATED = 'shelf:unauthenticated'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Could not reach the library')
  }

  const text = await response.text()
  const payload: unknown = text ? JSON.parse(text) : null

  if (!response.ok) {
    const shape = payload as { error?: string; details?: unknown } | null
    if (response.status === 401 && !path.startsWith('/api/auth/')) {
      window.dispatchEvent(new CustomEvent(UNAUTHENTICATED))
    }
    throw new ApiError(response.status, shape?.error ?? response.statusText, shape?.details)
  }

  return payload as T
}

type QueryValue = string | number | boolean | null | undefined

export function toQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const api = {
  session: () => request<{ authenticated: boolean }>('GET', '/api/auth/session'),
  login: (password: string) =>
    request<{ authenticated: boolean }>('POST', '/api/auth/login', { password }),
  logout: () => request<{ authenticated: boolean }>('POST', '/api/auth/logout'),

  room: (collection?: number | null, perShelf = 40) =>
    request<Room>('GET', `/api/room${toQuery({ collection, perShelf })}`),

  shelves: (kind?: 'manual' | 'smart') =>
    request<Shelf[]>('GET', `/api/shelves${toQuery({ kind })}`),
  shelf: (id: number, cursor?: string | null, limit = 40) =>
    request<ShelfRow>('GET', `/api/shelves/${id}${toQuery({ cursor, limit })}`),
  shelfBooks: (id: number, cursor?: string | null, limit = 40) =>
    request<{ books: Spine[]; nextCursor: string | null; total: number }>(
      'GET',
      `/api/shelves/${id}/books${toQuery({ cursor, limit })}`,
    ),
  createShelf: (payload: { name: string; note?: string | null }) =>
    request<Shelf>('POST', '/api/shelves', payload),
  updateShelf: (id: number, payload: { name?: string; note?: string | null }) =>
    request<Shelf>('PATCH', `/api/shelves/${id}`, payload),
  deleteShelf: (id: number) => request<{ deleted: number }>('DELETE', `/api/shelves/${id}`),
  addToShelf: (shelfId: number, bookId: number) =>
    request<unknown>('POST', `/api/shelves/${shelfId}/books`, { bookId }),
  removeFromShelf: (shelfId: number, bookId: number) =>
    request<unknown>('DELETE', `/api/shelves/${shelfId}/books/${bookId}`),
  reorderShelf: (shelfId: number, bookId: number, afterBookId: number | null) =>
    request<{ order: number[] }>('PATCH', `/api/shelves/${shelfId}/order`, { bookId, afterBookId }),

  books: (params: Record<string, QueryValue>) =>
    request<BookPage>('GET', `/api/books${toQuery(params)}`),
  book: (id: number) => request<Book>('GET', `/api/books/${id}`),
  createBook: (payload: BookPayload) => request<Book>('POST', '/api/books', payload),
  updateBook: (id: number, payload: BookPayload) =>
    request<Book>('PATCH', `/api/books/${id}`, payload),
  deleteBook: (id: number) => request<{ deleted: number }>('DELETE', `/api/books/${id}`),

  notes: (params: Record<string, QueryValue> = {}) =>
    request<NoteFeed>('GET', `/api/notes${toQuery(params)}`),
  addNote: (bookId: number, payload: { text: string; page?: number | null; kind?: string }) =>
    request<Note>('POST', `/api/books/${bookId}/notes`, payload),
  updateNote: (id: number, payload: { text?: string; page?: number | null }) =>
    request<Note>('PATCH', `/api/notes/${id}`, payload),
  deleteNote: (id: number) => request<{ deleted: number }>('DELETE', `/api/notes/${id}`),

  search: (term: string, facet: string, limit = 30) =>
    request<SearchResult>('GET', `/api/search${toQuery({ q: term, facet, limit })}`),

  lookupIsbn: (isbn: string) =>
    request<{ found: boolean; sources: string[]; book: BookDraft | null; existingBookId: number | null }>(
      'GET',
      `/api/lookup/isbn/${encodeURIComponent(isbn)}`,
    ),
  ownedIsbn: (isbn: string) =>
    request<{ book: { id: number; title: string; location: BookLocation } | null }>(
      'GET',
      `/api/lookup/owned/${encodeURIComponent(isbn)}`,
    ),
  lookupTitle: (term: string) =>
    request<{ term: string; sources: string[]; results: BookDraft[] }>(
      'GET',
      `/api/lookup/title${toQuery({ q: term })}`,
    ),

  facets: () => request<Facets>('GET', '/api/facets'),
  stats: () => request<Stats>('GET', '/api/stats'),
  authors: () => request<Author[]>('GET', '/api/authors'),
  updateAuthor: (id: number, payload: { name?: string; nationality?: string | null }) =>
    request<Author>('PATCH', `/api/authors/${id}`, payload),
  genres: () => request<Genre[]>('GET', '/api/genres'),
}

export const coverProxy = (url: string) => `/api/cover-proxy?url=${encodeURIComponent(url)}`
