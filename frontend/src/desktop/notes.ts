import { api } from '../api.ts'
import { el, mount } from '../dom.ts'
import { noteMeta } from '../format.ts'
import { toastError } from '../toast.ts'
import type { Note } from '../types.ts'

type Options = {
  onSelect: (bookId: number) => void
  mobile?: boolean
}

const PAGE = 30

export function notesView(options: Options): HTMLElement {
  const root = el('div', { class: options.mobile ? 'm-view' : 'view view-narrow' })
  const list = el('div', { class: 'stack', style: { gap: '22px' } })
  const heading = el('span', { class: 'mono' })

  let offset = 0
  let loading = false
  let done = false

  const noteRow = (note: Note): HTMLElement =>
    el(
      'button',
      {
        class: 'note-row',
        type: 'button',
        style: { width: '100%', textAlign: 'left' },
        onclick: () => options.onSelect(note.bookId),
      },
      el('span', {
        class: 'note-spine',
        style: { '--bg': note.spineColor } as Record<string, string>,
      }),
      el(
        'span',
        { class: 'grow', style: { display: 'flex', flexDirection: 'column', gap: '7px' } },
        el(
          'span',
          { class: 'row wrap', style: { gap: '12px', alignItems: 'baseline' } },
          el('span', { class: 'display', style: { fontSize: '17px' }, text: note.bookTitle }),
          el('span', { class: 'note-meta', text: noteMeta(note) }),
        ),
        el('span', { class: 'note-body', text: note.text }),
      ),
    )

  const sentinel = el('div', { style: { height: '1px' } })

  const loadMore = async () => {
    if (loading || done) return
    loading = true
    try {
      const feed = await api.notes({ limit: PAGE, offset })
      offset += feed.items.length
      done = !feed.hasMore

      heading.textContent = `${feed.total} ${feed.total === 1 ? 'note' : 'notes'} · newest first`

      if (feed.total === 0) {
        mount(list, el('p', { class: 'empty' }, 'No notes yet. Open a book and write the first one.'))
        done = true
        return
      }

      const fragment = document.createDocumentFragment()
      for (const note of feed.items) fragment.appendChild(noteRow(note))
      list.appendChild(fragment)
    } catch (err) {
      toastError(err)
      done = true
    } finally {
      loading = false
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        void loadMore().then(() => {
          if (done) observer.disconnect()
        })
      }
    },
    { rootMargin: '400px' },
  )

  mount(
    root,
    el(
      'div',
      { class: options.mobile ? 'stack' : 'view-head-stack', style: { gap: '5px' } },
      el('h1', { class: options.mobile ? 'm-title' : 'view-title', text: 'Notes' }),
      heading,
    ),
    list,
    sentinel,
  )

  observer.observe(sentinel)

  return root
}
