import { el } from '../dom.ts'
import { STATUS_VAR, spineVars } from '../format.ts'
import type { Spine } from '../types.ts'

type SpineOptions = {
  selected?: boolean
  dim?: boolean
  draggable?: boolean
  onSelect?: (spine: Spine) => void
}

export function spineNode(spine: Spine, options: SpineOptions = {}): HTMLElement {
  const ghost = spine.location === 'wishlist'

  const classes = ['spine']
  if (ghost) classes.push('spine-ghost')
  if (options.selected) classes.push('is-selected')
  if (options.dim) classes.push('is-dim')

  const node = el(
    'button',
    {
      class: classes.join(' '),
      type: 'button',
      title: `${spine.title}${spine.author ? ` — ${spine.author}` : ''}`,
      style: { ...spineVars(spine), cursor: options.draggable ? 'grab' : 'pointer' },
      dataset: { bookId: String(spine.id) },
      onclick: () => options.onSelect?.(spine),
    },
    el('span', { class: 'spine-title', text: spine.title }),
  )

  if (!ghost) {
    node.appendChild(el('span', { class: 'spine-band spine-band-top' }))
    node.appendChild(el('span', { class: 'spine-band spine-band-bottom' }))
    if (spine.readingStatus !== 'unread') {
      node.appendChild(
        el('span', {
          class: 'spine-status',
          style: { '--dot': STATUS_VAR[spine.readingStatus] } as Record<string, string>,
        }),
      )
    }
  }

  return node
}

export function highlightSpine(bookId: number | null): void {
  for (const node of document.querySelectorAll<HTMLElement>('.spine.is-selected')) {
    node.classList.remove('is-selected')
  }
  if (bookId === null) return

  const target = document.querySelector<HTMLElement>(`.spine[data-book-id="${bookId}"]`)
  if (!target) return

  target.classList.add('is-selected')
  target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
}

export function addSpineButton(onClick: () => void): HTMLElement {
  return el('button', {
    class: 'spine-add',
    type: 'button',
    title: 'Add a book to this shelf',
    text: '＋',
    onclick: onClick,
  })
}
