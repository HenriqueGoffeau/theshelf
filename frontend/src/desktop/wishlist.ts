import { api } from '../api.ts'
import { openAddBook } from '../components/addBook.ts'
import { spineNode } from '../components/spine.ts'
import { el, mount } from '../dom.ts'
import { toastError } from '../toast.ts'
import type { Book, Spine } from '../types.ts'

type Options = {
  onSelect: (id: number) => void
  mobile?: boolean
}

export function wishCard(book: Book, onSelect: (id: number) => void, mobile = false): HTMLElement {
  return el(
    'button',
    {
      class: mobile ? 'm-wish-card' : 'wish-card',
      type: 'button',
      onclick: () => onSelect(book.id),
    },
    el('span', { class: 'cover-blank' }),
    el(
      'span',
      { class: 'grow', style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
      el('span', { class: 'wish-title', text: book.title }),
      el('span', { class: 'wish-author', text: book.authors[0]?.name ?? 'Author unknown' }),
      book.wishReason ? el('span', { class: 'wish-why', text: book.wishReason }) : null,
    ),
    mobile ? el('span', { class: 'm-round', text: '＋' }) : null,
  )
}

export function wishlistView(options: Options): HTMLElement {
  const root = el('div', { class: options.mobile ? 'm-view' : 'view' })

  const render = async () => {
    try {
      const page = await api.books({ location: 'wishlist', pageSize: 200, sort: 'added_desc' })
      const books = page.items

      const ghosts: Spine[] = books.map((book) => ({ ...book, location: 'wishlist' }))

      mount(
        root,
        el(
          'div',
          { class: options.mobile ? 'stack' : 'view-head-stack', style: { gap: '5px' } },
          el('h1', {
            class: options.mobile ? 'm-title' : 'view-title',
            text: 'Wishlist',
          }),
          el('span', {
            class: 'mono',
            text: `${page.total} books · the empty shelf you keep filling`,
          }),
        ),
        books.length === 0
          ? el(
              'div',
              { class: 'stack' },
              el('p', { class: 'empty' }, 'Nothing wanted yet. Search by title to add the next one.'),
              el('button', {
                class: 'btn btn-accent',
                type: 'button',
                style: { alignSelf: 'flex-start' },
                text: '＋ Add a wish',
                onclick: () => openAddBook({ location: 'wishlist', onAdded: () => void render() }),
              }),
            )
          : el(
              'div',
              { class: 'shelf-block' },
              el(
                'div',
                { class: 'shelf-row hide-scroll', style: { height: options.mobile ? '150px' : '186px' } },
                ghosts.map((spine) =>
                  spineNode(spine, { onSelect: () => options.onSelect(spine.id) }),
                ),
                el('button', {
                  class: 'spine-add',
                  type: 'button',
                  text: '＋',
                  onclick: () => openAddBook({ location: 'wishlist', onAdded: () => void render() }),
                }),
              ),
              el('div', { class: 'plank' }),
            ),
        books.length > 0
          ? el(
              'div',
              { class: options.mobile ? 'stack' : 'wish-grid', style: options.mobile ? { gap: '12px' } : {} },
              books.map((book) => wishCard(book, options.onSelect, options.mobile)),
            )
          : null,
      )
    } catch (err) {
      toastError(err)
      mount(root, el('p', { class: 'empty' }, 'The wishlist would not open.'))
    }
  }

  mount(root, el('div', { class: 'loading' }, el('span', { class: 'spinner' }), 'Fetching the wishlist…'))
  void render()

  return root
}
