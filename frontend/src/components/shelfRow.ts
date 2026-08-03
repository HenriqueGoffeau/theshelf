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

const GHOSTS = [150, 168, 134, 178, 156, 142, 172, 160, 146, 164]

export function shelfRowNode(options: Options): HTMLElement {
  const { row } = options
  let cursor = row.nextCursor
  let loading = false

  const scroller = el('div', { class: 'shelf-row hide-scroll' })
  const rendered = new Set<number>()
  const sentinel = el('div', { style: { flex: 'none', width: '1px', height: '100%' } })

  const paint = (books: Spine[]) => {
    const fragment = document.createDocumentFragment()
    for (const spine of books) {
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
    sentinel.before(fragment)
  }

  const ghosts = el(
    'div',
    { class: 'shelf-skeleton' },
    GHOSTS.map((height, index) =>
      el('span', {
        class: 'spine-skeleton',
        style: { height: `${height}px`, width: `${30 + (index % 4) * 5}px` },
      }),
    ),
  )

  scroller.appendChild(sentinel)
  if (options.onAdd) scroller.appendChild(addSpineButton(options.onAdd))

  const loadMore = async () => {
    if (loading || !cursor) return
    loading = true
    try {
      const next = await api.shelfBooks(row.id, cursor)
      cursor = next.nextCursor
      paint(next.books)
    } catch (err) {
      toastError(err)
      cursor = null
    } finally {
      loading = false
    }
  }

  const watchTail = () => {
    if (!cursor) return
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

  const block = el(
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

  const hydrate = async () => {
    try {
      const page = await api.shelfBooks(row.id)
      cursor = page.nextCursor
      ghosts.remove()
      paint(page.books)
      watchTail()
    } catch (err) {
      ghosts.remove()
      toastError(err)
    }
  }

  if (!row.pending) {
    paint(row.books)
    watchTail()
  } else if (row.total > 0) {
    sentinel.before(ghosts)
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        void hydrate()
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(block)
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

  return block
}
