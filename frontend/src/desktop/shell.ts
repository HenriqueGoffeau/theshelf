import { openAddBook } from '../components/addBook.ts'
import { bookDetail } from '../components/bookDetail.ts'
import { openFilterDrawer, invalidateFacets } from '../components/filterDrawer.ts'
import { bindPaletteShortcut, openPalette } from '../components/palette.ts'
import { openSettings } from '../components/settings.ts'
import { highlightSpine } from '../components/spine.ts'
import { el, mount } from '../dom.ts'
import { onLibraryChanged } from '../events.ts'
import { searchShortcut } from '../format.ts'
import { scrollFade } from '../scrollFade.ts'
import { getState, setState, subscribe, type View } from '../store.ts'
import { desktopRoom } from './room.ts'
import { notesView } from './notes.ts'
import { wishlistView } from './wishlist.ts'

const NAV: { key: View; label: string }[] = [
  { key: 'room', label: 'Room' },
  { key: 'wishlist', label: 'Wishlist' },
  { key: 'notes', label: 'Notes' },
]

export function mountDesktop(app: HTMLElement, onSignedOut: () => void): () => void {
  const main = el('main', { class: 'main-column' })
  const panelHost = el('aside', { class: 'panel' })
  const navHost = el('nav', { class: 'nav' })

  const search = el('input', {
    placeholder: 'find a book, author, note…',
    value: getState().q,
  })

  let searchTimer: number | undefined
  search.addEventListener('input', () => {
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => setState({ q: search.value.trim() }), 260)
  })
  search.addEventListener('keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Enter') {
      openPalette(search.value.trim(), (id) => setState({ book: id }))
    }
  })

  const selectBook = (id: number) => setState({ book: id })

  const paintNav = () => {
    const state = getState()
    mount(
      navHost,
      NAV.map((entry) =>
        el('button', {
          class: `nav-item${state.view === entry.key ? ' is-on' : ''}`,
          type: 'button',
          text: entry.label,
          onclick: () => setState({ view: entry.key }, true),
        }),
      ),
    )
  }

  const paintMain = () => {
    const state = getState()
    if (state.view === 'wishlist') {
      mount(main, wishlistView({ onSelect: selectBook }))
    } else if (state.view === 'notes') {
      mount(main, notesView({ onSelect: selectBook }))
    } else {
      mount(
        main,
        desktopRoom({
          onSelect: (spine) => selectBook(spine.id),
          onOpenFilters: () => openFilterDrawer(paintMain),
        }),
      )
    }
  }

  let dropPanelFade: (() => void) | null = null

  const paintPanel = () => {
    dropPanelFade?.()
    dropPanelFade = null

    const state = getState()
    if (!state.book) {
      mount(
        panelHost,
        el('span', { class: 'label', text: 'off the shelf' }),
        el(
          'div',
          { class: 'panel-empty' },
          el('p', { text: 'Pull a book off the shelf to read what you wrote about it.' }),
          el('p', { text: `Press ${searchShortcut()} to search everything at once.` }),
        ),
      )
      return
    }

    const detail = bookDetail({
      bookId: state.book,
      variant: 'panel',
      onChanged: paintMain,
      onClose: () => setState({ book: null }),
    })
    mount(panelHost, detail.node, detail.footer)
    dropPanelFade = scrollFade(detail.node)
  }

  mount(
    app,
    el('div', { class: 'glow' }),
    el(
      'div',
      { class: 'app-desktop' },
      el(
        'header',
        { class: 'masthead' },
        el(
          'div',
          { class: 'masthead-left' },
          el('div', { class: 'wordmark', text: 'THE SHELF' }),
          navHost,
        ),
        el(
          'div',
          { class: 'masthead-right' },
          el(
            'div',
            { class: 'field masthead-search' },
            el('span', { style: { color: 'var(--ink-45)', fontSize: '13px' }, text: '⌕' }),
            search,
          ),
          el('button', {
            class: 'btn btn-accent',
            type: 'button',
            text: '＋ Add book',
            onclick: () => openAddBook({ onAdded: selectBook }),
          }),
          el('button', {
            class: 'avatar',
            type: 'button',
            title: 'The room',
            text: 'ME',
            onclick: () => openSettings(onSignedOut),
          }),
        ),
      ),
      el('div', { class: 'body-split' }, main, panelHost),
    ),
  )

  paintNav()
  paintMain()
  paintPanel()

  bindPaletteShortcut(selectBook)

  const unsubscribe = subscribe((next, previous) => {
    if (next.view !== previous.view) {
      paintNav()
      paintMain()
    } else if (
      next.collection !== previous.collection ||
      next.status !== previous.status ||
      next.q !== previous.q ||
      JSON.stringify(next.filters) !== JSON.stringify(previous.filters)
    ) {
      paintMain()
    }
    if (next.book !== previous.book) {
      paintPanel()
      highlightSpine(next.book)
    }
    if (next.q !== previous.q && search.value !== next.q) search.value = next.q
  })

  const unlisten = onLibraryChanged(() => {
    invalidateFacets()
    paintMain()
  })

  return () => {
    unsubscribe()
    unlisten()
    dropPanelFade?.()
  }
}
