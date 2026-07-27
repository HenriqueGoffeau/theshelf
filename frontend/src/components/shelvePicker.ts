import { api } from '../api.ts'
import { el, mount } from '../dom.ts'
import { toast, toastError } from '../toast.ts'
import type { Book, Shelf } from '../types.ts'
import { modal, openOverlay } from './overlay.ts'

export function openCreateShelf(onCreated: (shelfId: number) => void): void {
  const name = el('input', { class: 'input-block', placeholder: 'Books that broke me' })
  const note = el('input', { class: 'input-block', placeholder: 'kept apart on purpose' })

  openOverlay({
    content: modal(
      'Build a new shelf',
      el(
        'div',
        { class: 'stack', style: { gap: '12px' } },
        el('label', { class: 'form-field' }, el('span', { class: 'label', text: 'name' }), name),
        el('label', { class: 'form-field' }, el('span', { class: 'label', text: 'note' }), note),
        el('p', { class: 'empty', text: 'Your own shelves can be dragged into any order you like.' }),
      ),
      (close) => [
        el('button', {
          class: 'btn btn-accent',
          type: 'button',
          text: 'Build it',
          onclick: async () => {
            if (!name.value.trim()) return
            try {
              const shelf = await api.createShelf({
                name: name.value.trim(),
                note: note.value.trim() || null,
              })
              toast(`"${shelf.name}" is up`)
              onCreated(shelf.id)
              close()
            } catch (err) {
              toastError(err)
            }
          },
        }),
      ],
    ),
  })
}

export function shelvePicker(book: Book, onChanged: () => void): void {
  const list = el('div', { class: 'stack', style: { gap: '8px' } })
  const newName = el('input', { class: 'input-block', placeholder: 'Start a new shelf…' })

  const paint = (shelves: Shelf[], on: Set<number>) => {
    if (shelves.length === 0) {
      mount(list, el('p', { class: 'empty', text: 'No shelves of your own yet.' }))
      return
    }

    mount(
      list,
      shelves.map((shelf) => {
        const active = on.has(shelf.id)
        return el('button', {
          class: `chip${active ? ' is-on' : ''}`,
          type: 'button',
          style: { justifyContent: 'space-between', width: '100%' },
          onclick: async () => {
            try {
              if (active) await api.removeFromShelf(shelf.id, book.id)
              else await api.addToShelf(shelf.id, book.id)
              if (active) on.delete(shelf.id)
              else on.add(shelf.id)
              paint(shelves, on)
              onChanged()
            } catch (err) {
              toastError(err)
            }
          },
        }, el('span', { text: shelf.name }), el('span', { class: 'chip-count', text: String(shelf.bookCount) }))
      }),
    )
  }

  const load = async () => {
    const shelves = await api.shelves('manual')
    paint(shelves, new Set(book.shelves.map((entry) => entry.id)))
  }

  openOverlay({
    content: modal(
      'Shelve this book',
      el(
        'div',
        { class: 'stack' },
        list,
        el('div', { style: { height: '1px', background: 'var(--ink-10)' } }),
        newName,
      ),
      () => [
        el('button', {
          class: 'btn btn-accent',
          type: 'button',
          text: 'Create & shelve',
          onclick: async () => {
            const name = newName.value.trim()
            if (!name) return
            try {
              const shelf = await api.createShelf({ name })
              await api.addToShelf(shelf.id, book.id)
              newName.value = ''
              toast(`Shelved on "${shelf.name}"`)
              onChanged()
              await load()
            } catch (err) {
              toastError(err)
            }
          },
        }),
      ],
    ),
  })

  void load().catch(toastError)
}
