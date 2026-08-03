import { api } from '../api.ts'
import { openAddBook } from '../components/addBook.ts'
import { openCollectionMenu } from '../components/collectionMenu.ts'
import { shelfRowNode } from '../components/shelfRow.ts'
import { openShelfBookPicker } from '../components/shelfBookPicker.ts'
import { openCreateShelf, openDeleteShelf } from '../components/shelvePicker.ts'
import { el, mount } from '../dom.ts'
import { STATUS_LABEL, STATUS_ORDER, STATUS_VAR, volumeCount } from '../format.ts'
import { getState, setState, hasRoomFilter } from '../store.ts'
import { toastError } from '../toast.ts'
import type { Room, Spine } from '../types.ts'

type RoomOptions = {
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

export function desktopRoom(options: RoomOptions): HTMLElement {
  const root = el('div', { class: 'view' })

  const render = async () => {
    const state = getState()
    let room: Room
    try {
      room = await api.room(state.collection)
    } catch (err) {
      toastError(err)
      mount(root, el('p', { class: 'empty' }, 'The room would not open.'))
      return
    }

    const isDim = matcher()
    const collection = state.collection
      ? room.collections.find((entry) => entry.id === state.collection)
      : null

    const lit = room.shelves.reduce(
      (total, shelf) => total + shelf.books.filter((spine) => !isDim(spine)).length,
      0,
    )
    const shown = room.shelves.reduce((total, shelf) => total + shelf.books.length, 0)

    const meta = hasRoomFilter()
      ? `${lit} of ${shown} spines lit`
      : collection
        ? [volumeCount(room.shelves[0]?.total ?? 0), collection.note].filter(Boolean).join(' · ')
        : `${room.counts.all.toLocaleString()} volumes · ${room.collections.length} of your own shelves`

    const statusChips = [
      { key: 'all' as const, label: 'All', dot: 'var(--ink-40)', count: room.counts.all },
      ...STATUS_ORDER.map((status) => ({
        key: status,
        label: STATUS_LABEL[status],
        dot: STATUS_VAR[status],
        count: room.counts[status],
      })),
    ].map((chip) =>
      el(
        'button',
        {
          class: `chip${state.status === chip.key ? ' is-on' : ''}`,
          type: 'button',
          onclick: () => setState({ status: chip.key }),
        },
        el('span', { class: 'chip-dot', style: { '--dot': chip.dot } as Record<string, string> }),
        el('span', { text: chip.label }),
        el('span', { class: 'chip-count', text: String(chip.count ?? 0) }),
      ),
    )

    const picker = el(
      'button',
      {
        class: `chip${collection ? ' is-on' : ''}`,
        type: 'button',
        onclick: () =>
          openCollectionMenu({
            anchor: picker,
            current: state.collection,
            onPick: (id) => setState({ collection: id }),
          }),
      },
      el('span', { text: collection ? collection.name : 'The whole room' }),
      el('span', { class: 'chip-count', text: `${room.collections.length + 1} shelves ▾` }),
    )

    mount(
      root,
      el(
        'div',
        { class: 'view-head' },
        el(
          'div',
          { class: 'view-head-stack' },
          el('h1', { class: 'view-title', text: collection ? collection.name : 'Your room' }),
          el('span', { class: 'mono', text: meta }),
        ),
        el('div', { class: 'chip-bar' }, statusChips),
      ),
      el(
        'div',
        { class: 'row wrap', style: { gap: '10px' } },
        picker,
        el('button', {
          class: 'chip',
          type: 'button',
          text: '＋ New shelf',
          onclick: () => openCreateShelf((id) => setState({ collection: id })),
        }),
        collection
          ? el('button', {
              class: 'chip',
              type: 'button',
              text: '✕ Take it down',
              onclick: () => void openDeleteShelf(collection, () => setState({ collection: null })),
            })
          : null,
        el('button', {
          class: 'chip',
          type: 'button',
          text: '⚙ Filters',
          onclick: options.onOpenFilters,
        }),
        collection
          ? el('span', { class: 'mono', text: 'drag spines to arrange this shelf' })
          : null,
      ),
      room.shelves.length === 0
        ? el('p', { class: 'empty' }, 'This shelf is empty. Add a book and it will appear here.')
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
      el('button', {
        class: 'build-shelf',
        type: 'button',
        text: 'Build a new shelf',
        onclick: () => openCreateShelf((id) => setState({ collection: id })),
      }),
    )
  }

  mount(root, el('div', { class: 'loading' }, el('span', { class: 'spinner' }), 'Opening the room…'))
  void render()

  return root
}
