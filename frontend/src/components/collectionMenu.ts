import { api } from '../api.ts'
import { el, mount } from '../dom.ts'
import { toastError } from '../toast.ts'
import type { Shelf } from '../types.ts'
import { openPopover } from './overlay.ts'
import { openCreateShelf } from './shelvePicker.ts'

type Options = {
  anchor: HTMLElement
  current: number | null
  onPick: (collectionId: number | null) => void
}

export function openCollectionMenu(options: Options): void {
  const filter = el('input', {
    class: 'input-block',
    placeholder: 'Find a shelf…',
    autocomplete: 'off',
  })
  const list = el('div', { class: 'stack', style: { gap: '2px' } })
  let shelves: Shelf[] = []

  const entry = (label: string, note: string, active: boolean, onClick: () => void) =>
    el(
      'button',
      {
        class: `menu-row${active ? ' is-on' : ''}`,
        type: 'button',
        onclick: onClick,
      },
      el(
        'span',
        { class: 'grow', style: { display: 'flex', flexDirection: 'column', gap: '2px' } },
        el('span', { class: 'menu-row-title', text: label }),
        note ? el('span', { class: 'menu-row-sub', text: note }) : null,
      ),
      active ? el('span', { class: 'label', text: 'showing' }) : null,
    )

  const paint = (close: () => void) => {
    const term = filter.value.trim().toLowerCase()
    const matching = shelves.filter((shelf) => shelf.name.toLowerCase().includes(term))

    mount(
      list,
      term
        ? null
        : entry('The whole room', 'every shelf, arranged for you', options.current === null, () => {
            options.onPick(null)
            close()
          }),
      matching.length === 0
        ? el(
            'p',
            { class: 'empty' },
            shelves.length === 0 ? 'No shelves of your own yet.' : 'No shelf by that name.',
          )
        : matching.map((shelf) =>
            entry(
              shelf.name,
              `${shelf.bookCount} ${shelf.bookCount === 1 ? 'book' : 'books'}${shelf.note ? ` · ${shelf.note}` : ''}`,
              options.current === shelf.id,
              () => {
                options.onPick(shelf.id)
                close()
              },
            ),
          ),
    )
  }

  const close = openPopover({
    anchor: options.anchor,
    content: (dismiss) =>
      el(
        'div',
        {},
        el('span', { class: 'label', text: 'shelves' }),
        filter,
        el('div', { class: 'popover-scroll' }, list),
        el('button', {
          class: 'btn btn-accent',
          type: 'button',
          text: '＋ New shelf',
          onclick: () => {
            dismiss()
            openCreateShelf((id) => options.onPick(id))
          },
        }),
      ),
  })

  filter.addEventListener('input', () => paint(close))

  mount(list, el('div', { class: 'loading' }, el('span', { class: 'spinner' }), 'Reading the shelves…'))
  void api
    .shelves('manual')
    .then((found) => {
      shelves = found
      paint(close)
    })
    .catch(toastError)
}
