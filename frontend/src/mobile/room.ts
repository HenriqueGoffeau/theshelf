import { api } from '../api.ts'
import { openAddBook } from '../components/addBook.ts'
import { openCollectionMenu } from '../components/collectionMenu.ts'
import { shelfRowNode } from '../components/shelfRow.ts'
import { openShelfBookPicker } from '../components/shelfBookPicker.ts'
import { openCreateShelf, openDeleteShelf } from '../components/shelvePicker.ts'
import { el, mount } from '../dom.ts'
import { STATUS_LABEL, STATUS_ORDER, STATUS_VAR } from '../format.ts'
import { getState, setState } from '../store.ts'
import { toastError } from '../toast.ts'
import type { Room, Spine } from '../types.ts'

type Options = {
  onSelect: (spine: Spine) => void
  onOpenFilters: () => void
}

function matcher(): (spine: Spine) => boolean {
  const state = getState()
  const term = state.q.trim().toLowerCase()

  return (spine) => {
    if (state.status !== 'all' && spine.readingStatus !== state.status) return true
    if (state.filters.minRating && (spine.rating ?? 0) < state.filters.minRating) return true
    if (!term) return false
    return !`${spine.title} ${spine.author}`.toLowerCase().includes(term)
  }
}

export function mobileRoom(options: Options): HTMLElement {
  const root = el('div', { class: 'm-body' })

  const render = async () => {
    const state = getState()
    let room: Room
    try {
      room = await api.room(state.collection, 24)
    } catch (err) {
      toastError(err)
      mount(root, el('p', { class: 'empty', style: { padding: '20px' } }, 'The room would not open.'))
      return
    }

    const isDim = matcher()
    const collection = state.collection
      ? room.collections.find((entry) => entry.id === state.collection)
      : null

    const picker = el(
      'button',
      {
        class: `chip${collection ? ' is-on' : ''}`,
        type: 'button',
        style: { height: '44px', fontSize: '15px' },
        onclick: () =>
          openCollectionMenu({
            anchor: picker,
            current: state.collection,
            onPick: (id) => setState({ collection: id }),
          }),
      },
      el('span', { text: collection ? collection.name : 'The whole room' }),
      el('span', { class: 'chip-count', text: '▾' }),
    )

    mount(
      root,
      el(
        'div',
        { class: 'row', style: { gap: '8px', padding: '0 20px', overflowX: 'auto' } },
        picker,
        el('button', {
          class: 'chip',
          type: 'button',
          style: { height: '44px', fontSize: '15px' },
          text: '＋ Shelf',
          onclick: () => openCreateShelf((id) => setState({ collection: id })),
        }),
        collection
          ? el('button', {
              class: 'chip',
              type: 'button',
              style: { height: '44px', fontSize: '15px' },
              text: '✕ Take it down',
              onclick: () => void openDeleteShelf(collection),
            })
          : null,
        el('button', {
          class: 'chip',
          type: 'button',
          style: { height: '44px', fontSize: '15px' },
          text: '⚙ Filters',
          onclick: options.onOpenFilters,
        }),
      ),
      collection
        ? el('div', { class: 'mono', style: { padding: '0 20px' }, text: 'hold and drag a spine to arrange' })
        : null,
      room.shelves.length === 0
        ? el('p', { class: 'empty', style: { padding: '20px' } }, 'Nothing here yet.')
        : room.shelves.map((shelf) =>
            shelfRowNode({
              row: shelf,
              isDim,
              onSelect: options.onSelect,
              reorderable: shelf.canReorder,
              onAdd: () =>
                shelf.kind === 'manual'
                  ? openShelfBookPicker(shelf.id, shelf.name, render)
                  : openAddBook({ onAdded: (id) => setState({ book: id }) }),
            }),
          ),
    )
  }

  mount(root, el('div', { class: 'loading', style: { padding: '20px' } }, el('span', { class: 'spinner' }), 'Opening the room…'))
  void render()

  return root
}

export function mobileChips(counts: Room['counts'], onPick: () => void): HTMLElement {
  const state = getState()
  const chips = [
    { key: 'all' as const, label: 'All', dot: 'var(--ink-40)', count: counts.all },
    ...STATUS_ORDER.map((status) => ({
      key: status,
      label: STATUS_LABEL[status],
      dot: STATUS_VAR[status],
      count: counts[status],
    })),
  ]

  return el(
    'div',
    { class: 'm-chips' },
    chips.map((chip) =>
      el(
        'button',
        {
          class: `chip${state.status === chip.key ? ' is-on' : ''}`,
          type: 'button',
          onclick: () => {
            setState({ status: chip.key })
            onPick()
          },
        },
        el('span', { class: 'chip-dot', style: { '--dot': chip.dot } as Record<string, string> }),
        el('span', { text: chip.label }),
        el('span', { class: 'chip-count', text: String(chip.count ?? 0) }),
      ),
    ),
  )
}
