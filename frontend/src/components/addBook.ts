import { api, coverProxy } from '../api.ts'
import { el, mount } from '../dom.ts'
import { libraryChanged } from '../events.ts'
import { toast, toastError } from '../toast.ts'
import type { BookDraft, BookLocation } from '../types.ts'
import { modal, openOverlay } from './overlay.ts'

type AddOptions = {
  location?: BookLocation
  onAdded?: (bookId: number) => void
}

function draftRow(draft: BookDraft, onPick: () => void): HTMLElement {
  const meta = [draft.authors[0], draft.publishedYear, draft.publisher].filter(Boolean).join(' · ')

  return el(
    'button',
    { class: 'result-row', type: 'button', style: { padding: '12px 4px' }, onclick: onPick },
    draft.coverUrl
      ? el('img', {
          class: 'cover',
          src: coverProxy(draft.coverUrl),
          alt: '',
          loading: 'lazy',
          style: { width: '34px', height: '52px', flex: 'none' },
        })
      : el('span', { class: 'cover-blank', style: { width: '34px', height: '52px', flex: 'none' } }),
    el(
      'span',
      { class: 'grow', style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
      el('span', { class: 'result-title', style: { fontSize: '17px' }, text: draft.title }),
      el('span', { class: 'result-sub', text: meta || 'no details' }),
    ),
    draft.existingBookId
      ? el('span', { class: 'mono', text: 'already yours' })
      : el('span', { class: 'label', text: 'add' }),
  )
}

export function openAddBook(options: AddOptions = {}): void {
  const location: BookLocation = options.location ?? 'owned'
  const wishlist = location === 'wishlist'

  let mode: 'title' | 'isbn' = wishlist ? 'title' : 'isbn'

  const input = el('input', {
    class: 'input-block',
    placeholder: wishlist ? 'Title of the book you want…' : '978-0-14-118776-1',
    autocomplete: 'off',
  })
  const results = el('div', { class: 'stack', style: { gap: '0' } })
  const status = el('div', { class: 'mono' })

  const modeRow = el('div', { class: 'row', style: { gap: '8px' } })

  const save = async (draft: BookDraft, extra: { wishReason?: string | null } = {}) => {
    try {
      const book = await api.createBook({
        title: draft.title,
        subtitle: draft.subtitle,
        authors: draft.authors,
        genres: draft.genres,
        isbn: draft.isbn13 ?? draft.isbn10,
        publisher: draft.publisher,
        publishedYear: draft.publishedYear,
        pageCount: draft.pageCount,
        language: draft.language,
        description: draft.description,
        coverUrl: draft.coverUrl,
        location,
        source: 'catalogue',
        ...extra,
      })
      libraryChanged()
      toast(wishlist ? `"${book.title}" added to the wishlist` : `"${book.title}" is on the shelf`)
      options.onAdded?.(book.id)
      close()
    } catch (err) {
      toastError(err)
    }
  }

  const pick = (draft: BookDraft) => {
    if (draft.existingBookId) {
      options.onAdded?.(draft.existingBookId)
      close()
      return
    }
    if (!wishlist) {
      void save(draft)
      return
    }

    const why = el('input', { class: 'input-block', placeholder: 'why do you want it?' })
    mount(
      results,
      el(
        'div',
        { class: 'stack', style: { gap: '12px' } },
        el('div', { class: 'label', text: 'chosen' }),
        draftRow(draft, () => {}),
        why,
        el(
          'div',
          { class: 'row', style: { gap: '10px', justifyContent: 'flex-end' } },
          el('button', { class: 'btn', type: 'button', text: 'Back', onclick: () => void run() }),
          el('button', {
            class: 'btn btn-accent',
            type: 'button',
            text: 'Add to wishlist',
            onclick: () => void save(draft, { wishReason: why.value.trim() || null }),
          }),
        ),
      ),
    )
    why.focus()
  }

  const manualEntry = () => {
    const title = el('input', { class: 'input-block', value: input.value.trim() })
    const authors = el('input', { class: 'input-block', placeholder: 'Author' })
    const year = el('input', { class: 'input-block', type: 'number', placeholder: 'Year' })
    const why = el('input', { class: 'input-block', placeholder: 'why do you want it?' })

    const field = (label: string, control: HTMLElement) =>
      el('label', { class: 'form-field' }, el('span', { class: 'label', text: label }), control)

    mount(
      results,
      el(
        'div',
        { class: 'stack', style: { gap: '12px' } },
        el('div', { class: 'label', text: 'by hand' }),
        field('Title', title),
        el('div', { class: 'form-grid' }, field('Author', authors), field('Year', year)),
        wishlist ? field('Reason', why) : null,
        wishlist
          ? el('p', { class: 'empty', text: 'Wishlist entries have no cover until you own the book.' })
          : null,
        el(
          'div',
          { class: 'row', style: { gap: '10px', justifyContent: 'flex-end' } },
          el('button', { class: 'btn', type: 'button', text: 'Back', onclick: () => void run() }),
          el('button', {
            class: 'btn btn-accent',
            type: 'button',
            text: 'Add',
            onclick: () => {
              if (!title.value.trim()) return
              void save(
                {
                  isbn13: null,
                  isbn10: null,
                  title: title.value.trim(),
                  subtitle: null,
                  authors: authors.value.trim() ? [authors.value.trim()] : [],
                  publisher: null,
                  publishedYear: year.value ? Number(year.value) : null,
                  pageCount: null,
                  language: null,
                  description: null,
                  coverUrl: null,
                  genres: [],
                },
                wishlist ? { wishReason: why.value.trim() || null } : {},
              )
            },
          }),
        ),
      ),
    )
    title.focus()
  }

  const run = async () => {
    const term = input.value.trim()
    if (!term) {
      mount(results)
      status.textContent = ''
      return
    }

    status.textContent = 'asking the catalogues…'
    mount(results, el('div', { class: 'loading' }, el('span', { class: 'spinner' }), 'Searching…'))

    try {
      if (mode === 'isbn') {
        const found = await api.lookupIsbn(term)
        status.textContent = found.sources.join(' · ') || 'no source'
        if (found.existingBookId) {
          mount(
            results,
            el('p', { class: 'empty', text: 'That ISBN is already in your library.' }),
            el('button', {
              class: 'btn btn-accent',
              type: 'button',
              text: 'Open it',
              onclick: () => {
                options.onAdded?.(found.existingBookId as number)
                close()
              },
            }),
          )
          return
        }
        if (!found.book) {
          mount(
            results,
            el('p', { class: 'empty', text: 'Neither catalogue knows that ISBN.' }),
            el('button', { class: 'btn', type: 'button', text: 'Enter it by hand', onclick: manualEntry }),
          )
          return
        }
        mount(results, draftRow(found.book, () => pick(found.book as BookDraft)))
        return
      }

      const found = await api.lookupTitle(term)
      status.textContent = `${found.results.length} found · ${found.sources.join(' · ') || 'no source'}`
      if (found.results.length === 0) {
        mount(
          results,
          el('p', { class: 'empty', text: 'No titles matched.' }),
          el('button', { class: 'btn', type: 'button', text: 'Enter it by hand', onclick: manualEntry }),
        )
        return
      }
      mount(results, found.results.map((draft) => draftRow(draft, () => pick(draft))))
    } catch (err) {
      status.textContent = ''
      mount(results, el('p', { class: 'empty', text: err instanceof Error ? err.message : 'Search failed' }))
    }
  }

  const paintModes = () => {
    const options: { key: 'isbn' | 'title'; label: string }[] = [
      { key: 'isbn', label: 'By ISBN' },
      { key: 'title', label: 'By title' },
    ]
    mount(
      modeRow,
      options.map((option) =>
        el('button', {
          class: `chip${mode === option.key ? ' is-on' : ''}`,
          type: 'button',
          text: option.label,
          onclick: () => {
            mode = option.key
            input.placeholder = option.key === 'isbn' ? '978-0-14-118776-1' : 'Title of the book…'
            paintModes()
            void run()
          },
        }),
      ),
    )
  }

  let debounce: number | undefined
  input.addEventListener('input', () => {
    window.clearTimeout(debounce)
    debounce = window.setTimeout(() => void run(), 420)
  })
  input.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Enter') {
      window.clearTimeout(debounce)
      void run()
    }
  })

  paintModes()

  const close = openOverlay({
    content: modal(
      wishlist ? 'Add to the wishlist' : 'Add a book',
      el(
        'div',
        { class: 'stack', style: { gap: '14px' } },
        wishlist
          ? el('p', { class: 'empty', text: 'Search by name — no ISBN needed for books you do not have yet.' })
          : modeRow,
        input,
        status,
        el('div', { style: { maxHeight: '46vh', overflowY: 'auto' } }, results),
        el('button', {
          class: 'btn btn-quiet',
          type: 'button',
          style: { alignSelf: 'flex-start' },
          text: 'Enter it by hand →',
          onclick: manualEntry,
        }),
      ),
    ),
  })
}
