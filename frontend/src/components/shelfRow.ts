import { api } from '../api.ts'
import { el } from '../dom.ts'
import { volumeCount } from '../format.ts'
import { getState } from '../store.ts'
import { toastError } from '../toast.ts'
import type { ShelfRow, Spine } from '../types.ts'
import { enableDragReorder } from './dragReorder.ts'
import { addSpineButton, spineNode } from './spine.ts'

type Options = {
  row: ShelfRow
  isDim: (spine: Spine) => boolean
  onSelect: (spine: Spine) => void
  onAdd?: () => void
  reorderable?: boolean
}

export function shelfRowNode(options: Options): HTMLElement {
  const { row } = options
  let cursor = row.nextCursor
  let loading = false

  const scroller = el('div', { class: 'shelf-row hide-scroll' })
  const rendered = new Set<number>()

  const paint = (books: Spine[]) => {
    for (const spine of books) {
      if (rendered.has(spine.id)) continue
      rendered.add(spine.id)
      scroller.appendChild(
        spineNode(spine, {
          selected: spine.id === getState().book,
          dim: options.isDim(spine),
          draggable: options.reorderable,
          onSelect: options.onSelect,
        }),
      )
    }
  }

  paint(row.books)

  const sentinel = el('div', { style: { flex: 'none', width: '1px', height: '100%' } })
  scroller.appendChild(sentinel)

  if (options.onAdd) scroller.appendChild(addSpineButton(options.onAdd))

  const loadMore = async () => {
    if (loading || !cursor) return
    loading = true
    try {
      const next = await api.shelfBooks(row.id, cursor)
      cursor = next.nextCursor
      const anchor = sentinel
      const fragment = document.createDocumentFragment()
      for (const spine of next.books) {
        if (rendered.has(spine.id)) continue
        rendered.add(spine.id)
        fragment.appendChild(
          spineNode(spine, {
            selected: spine.id === getState().book,
            dim: options.isDim(spine),
            draggable: options.reorderable,
            onSelect: options.onSelect,
          }),
        )
      }
      anchor.before(fragment)
    } catch (err) {
      toastError(err)
      cursor = null
    } finally {
      loading = false
    }
  }

  if (cursor) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore().then(() => {
            if (!cursor) observer.disconnect()
          })
        }
      },
      { root: scroller, rootMargin: '0px 400px 0px 0px' },
    )
    observer.observe(sentinel)
  }

  if (options.reorderable) {
    enableDragReorder(scroller, async (bookId, afterBookId) => {
      try {
        await api.reorderShelf(row.id, bookId, afterBookId)
      } catch (err) {
        toastError(err)
      }
    })
  }

  return el(
    'section',
    { class: 'shelf-block' },
    el(
      'div',
      { class: 'shelf-head' },
      el(
        'div',
        { class: 'row', style: { gap: '14px', alignItems: 'baseline' } },
        el('span', { class: 'shelf-name', text: row.name }),
        row.note ? el('span', { class: 'shelf-note', text: row.note }) : null,
      ),
      el('span', {
        class: 'mono',
        text: options.reorderable ? `${volumeCount(row.total)} · drag to arrange` : volumeCount(row.total),
      }),
    ),
    scroller,
    el('div', { class: 'plank' }),
  )
}
