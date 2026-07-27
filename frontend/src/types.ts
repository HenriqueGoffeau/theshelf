export type ReadingStatus = 'unread' | 'reading' | 'finished' | 'aside'
export type BookLocation = 'owned' | 'wishlist'
export type NoteKind = 'note' | 'review' | 'started' | 'finished'
export type ShelfKind = 'manual' | 'smart'
export type Facet = 'books' | 'notes' | 'wishlist' | 'authors'

export type Spine = {
  id: number
  title: string
  author: string
  publishedYear: number | null
  readingStatus: ReadingStatus
  location: BookLocation
  rating: number | null
  coverUrl: string | null
  pageCount: number | null
  spineColor: string
  spineWidth: number
  spineHeight: number
  spineAuto: boolean
  shelfName?: string | null
}

export type AuthorRef = { id: number; name: string; nationality: string | null }
export type GenreRef = { id: number; name: string }
export type ShelfRef = { id: number; name: string }

export type Book = Spine & {
  isbn13: string | null
  isbn10: string | null
  subtitle: string | null
  publisher: string | null
  language: string | null
  description: string | null
  source: string
  wishReason: string | null
  acquiredOn: string | null
  createdAt: string
  updatedAt: string
  authors: AuthorRef[]
  genres: GenreRef[]
  shelves: ShelfRef[]
  noteCount: number
}

export type Note = {
  id: number
  bookId: number
  page: number | null
  kind: NoteKind
  text: string
  createdAt: string
  bookTitle: string
  spineColor: string
}

export type Shelf = {
  id: number
  name: string
  note: string | null
  kind: ShelfKind
  position: number
  bookCount: number
}

export type ShelfRow = {
  id: number
  name: string
  note: string | null
  kind: ShelfKind
  canReorder: boolean
  total: number
  books: Spine[]
  nextCursor: string | null
}

export type RoomCounts = {
  all: number
  reading: number
  finished: number
  aside: number
  unread: number
  wishlist: number
}

export type Room = {
  shelves: ShelfRow[]
  counts: RoomCounts
  collections: Shelf[]
}

export type BookPage = {
  items: Book[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type NoteFeed = { items: Note[]; total: number; hasMore: boolean }

export type SearchCounts = { books: number; notes: number; wishlist: number; authors: number }

export type SearchResult = {
  term: string
  facet: Facet
  counts: SearchCounts
  items: (Spine | Note | Author)[]
}

export type Author = { id: number; name: string; nationality: string | null; bookCount: number }
export type Genre = { id: number; name: string; bookCount: number }
export type FacetValue = { value: string; bookCount: number }

export type Facets = {
  authors: Author[]
  genres: Genre[]
  nationalities: FacetValue[]
  publishers: FacetValue[]
  languages: FacetValue[]
  years: { value: number; bookCount: number }[]
}

export type Stats = {
  booksOwned: number
  wishlist: number
  finished: number
  reading: number
  aside: number
  unread: number
  pagesRead: number
  averageRating: number | null
  lastShelved: string | null
  authors: number
  genres: number
  notes: number
  collections: number
  booksWithNotes: number
}

export type BookDraft = {
  isbn13: string | null
  isbn10: string | null
  title: string
  subtitle: string | null
  authors: string[]
  publisher: string | null
  publishedYear: number | null
  pageCount: number | null
  language: string | null
  description: string | null
  coverUrl: string | null
  genres: string[]
  existingBookId?: number | null
}

export type BookPayload = Partial<{
  isbn: string | null
  title: string
  subtitle: string | null
  publisher: string | null
  publishedYear: number | null
  pageCount: number | null
  language: string | null
  description: string | null
  coverUrl: string | null
  location: BookLocation
  readingStatus: ReadingStatus
  rating: number | null
  wishReason: string | null
  spineColor: string | null
  spineWidth: number | null
  spineHeight: number | null
  acquiredOn: string | null
  source: string
  authors: string[]
  genres: string[]
}>
