import { api, coverProxy } from '../api.ts'
import { el, mount } from '../dom.ts'
import { libraryChanged } from '../events.ts'
import { toast, toastError } from '../toast.ts'
import type { Book } from '../types.ts'
import { openAddBook } from './addBook.ts'
import { modal, openOverlay } from './overlay.ts'

export function openShelfBookPicker(
  shelfId: number,
  shelfName: string,
  onChanged: () => void,
): void {
  const onShelf = new Set<number>()
  const list = el('div', { class: 'stack', style: { gap: '2px' } })
  const search = el('input', { class: 'input-block', placeholder: 'Search your books…', autocomplete: 'off' })
  const status = el('div', { class: 'mono' })

  const row = (book: Book): HTMLElement => {
    const already = onShelf.has(book.id)

    const button = el(
      'button',
      {
        class: 'result-row',
        type: 'button',
        style: { padding: '10px 4px', minHeight: '62px' },
        disabled: already,
        onclick: async () => {
          try {
            await api.addToShelf(shelfId, book.id)
            onShelf.add(book.id)
            libraryChanged()
            onChanged()
            toast(`"${book.title}" shelved`)
            button.replaceWith(row(book))
          } catch (err) {
            toastError(err)
          }
        },
      },
      book.coverUrl
        ? el('img', {
            class: 'cover',
            src: coverProxy(book.coverUrl),
            alt: '',
            loading: 'lazy',
            style: { width: '30px', height: '45px', flex: 'none' },
          })
        : el('span', {
            class: 'result-spine',
            style: { '--bg': book.spineColor, height: '45px', width: '14px' } as Record<string, string>,
          }),
      el(
        'span',
        { class: 'grow', style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
        el('span', { class: 'result-title', style: { fontSize: '17px' }, text: book.title }),
        el('span', {
          class: 'result-sub',
          text: [book.author, book.publishedYear].filter(Boolean).join(' · ') || 'no details',
        }),
      ),
      el('span', {
        class: already ? 'mono' : 'label',
        style: already ? {} : { color: 'var(--accent)' },
        text: already ? 'on this shelf' : '＋ add',
      }),
    )

    return button
  }

  const load = async () => {
    const term = search.value.trim()
    status.textContent = 'looking…'
    try {
      const page = await api.books({ location: 'owned', q: term, pageSize: 60, sort: 'title_asc' })
      status.textContent = `${page.total} in your library`

      if (page.items.length === 0) {
        mount(list, el('p', { class: 'empty' }, term ? 'No book of yours matches that.' : 'Your library is empty.'))
        return
      }
      mount(list, page.items.map(row))
    } catch (err) {
      status.textContent = ''
      toastError(err)
    }
  }

  let debounce: number | undefined
  search.addEventListener('input', () => {
    window.clearTimeout(debounce)
    debounce = window.setTimeout(() => void load(), 240)
  })

  openOverlay({
    content: modal(
      `Add to ${shelfName}`,
      el(
        'div',
        { class: 'stack', style: { gap: '12px' } },
        search,
        status,
        el('div', { style: { maxHeight: '48vh', overflowY: 'auto' } }, list),
      ),
      (close) => [
        el('button', {
          class: 'btn',
          type: 'button',
          text: 'Book not in the library yet →',
          onclick: () => {
            close()
            openAddBook({
              onAdded: async (bookId) => {
                try {
                  await api.addToShelf(shelfId, bookId)
                  libraryChanged()
                  onChanged()
                } catch (err) {
                  toastError(err)
                }
              },
            })
          },
        }),
      ],
    ),
  })

  void (async () => {
    try {
      const current = await api.shelfBooks(shelfId, null, 200)
      for (const spine of current.books) onShelf.add(spine.id)
    } catch {
    }
    await load()
  })()
}
