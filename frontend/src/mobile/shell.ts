import { api } from '../api.ts'
import { openAddBook } from '../components/addBook.ts'
import { bookDetail } from '../components/bookDetail.ts'
import { invalidateFacets, openFilterDrawer } from '../components/filterDrawer.ts'
import { openSettings } from '../components/settings.ts'
import { highlightSpine } from '../components/spine.ts'
import { el, mount } from '../dom.ts'
import { onLibraryChanged } from '../events.ts'
import { scrollFade } from '../scrollFade.ts'
import { getState, setState, subscribe, type View } from '../store.ts'
import { notesView } from '../desktop/notes.ts'
import { wishlistView } from '../desktop/wishlist.ts'
import { mobileChips, mobileRoom } from './room.ts'
import { mobileSearch } from './search.ts'
import type { RoomCounts } from '../types.ts'

const TABS: { key: View; label: string; glyph: string }[] = [
  { key: 'room', label: 'ROOM', glyph: 'R' },
  { key: 'search', label: 'SEARCH', glyph: 'S' },
  { key: 'wishlist', label: 'WISHLIST', glyph: 'W' },
  { key: 'notes', label: 'NOTES', glyph: 'N' },
]

const EMPTY_COUNTS: RoomCounts = {
  all: 0,
  reading: 0,
  finished: 0,
  aside: 0,
  unread: 0,
  wishlist: 0,
}

export function mountMobile(app: HTMLElement, onSignedOut: () => void): () => void {
  const head = el('header', { class: 'm-head' })
  const body = el('div', { class: 'grow', style: { display: 'flex', flexDirection: 'column' } })
  const tabbar = el('nav', { class: 'tabbar' })

  let counts: RoomCounts = EMPTY_COUNTS
  let sheet: HTMLElement | null = null
  let sheetBackdrop: HTMLElement | null = null
  let dropSheetFade: (() => void) | null = null

  const closeSheet = () => {
    dropSheetFade?.()
    dropSheetFade = null
    sheet?.remove()
    sheetBackdrop?.remove()
    sheet = null
    sheetBackdrop = null
    body.classList.remove('room-behind')
    if (getState().book !== null) setState({ book: null })
    highlightSpine(null)
  }

  const openSheet = (bookId: number) => {
    closeSheet()
    if (getState().book !== bookId) setState({ book: bookId })
    highlightSpine(bookId)

    const detail = bookDetail({
      bookId,
      variant: 'sheet',
      onChanged: paintBody,
      onClose: closeSheet,
    })

    const grab = el('div', { class: 'sheet-grab' })
    const sheetBody = el('div', { class: 'sheet-body' }, detail.node)
    sheet = el('div', { class: 'sheet' }, grab, sheetBody, detail.footer)
    dropSheetFade = scrollFade(sheetBody)

    sheetBackdrop = el('div', { class: 'backdrop', onclick: closeSheet })

    let startY = 0
    let dragging = false
    grab.addEventListener('pointerdown', (event) => {
      dragging = true
      startY = event.clientY
      grab.setPointerCapture(event.pointerId)
    })
    grab.addEventListener('pointermove', (event) => {
      if (!dragging || !sheet) return
      const dy = Math.max(0, event.clientY - startY)
      sheet.style.transform = `translateY(${dy}px)`
    })
    grab.addEventListener('pointerup', (event) => {
      if (!dragging || !sheet) return
      dragging = false
      const dy = Math.max(0, event.clientY - startY)
      if (dy > 120) closeSheet()
      else sheet.style.transform = ''
    })

    document.body.appendChild(sheetBackdrop)
    document.body.appendChild(sheet)
    body.classList.add('room-behind')
  }

  const paintHead = () => {
    const state = getState()

    if (state.view === 'search') {
      mount(head)
      head.style.display = 'none'
      return
    }
    head.style.display = ''

    const top = el(
      'div',
      { class: 'm-head-top' },
      el('div', { class: 'm-wordmark', text: 'THE SHELF' }),
      el(
        'div',
        { class: 'row', style: { gap: '10px' } },
        el('button', {
          class: 'm-round',
          type: 'button',
          text: '＋',
          'aria-label': 'Add a book',
          onclick: () =>
            openAddBook({
              location: state.view === 'wishlist' ? 'wishlist' : 'owned',
              onAdded: (id) => setState({ book: id }),
            }),
        }),
        el('button', {
          class: 'avatar',
          type: 'button',
          style: { width: '38px', height: '38px' },
          text: 'ME',
          onclick: () => openSettings(onSignedOut),
        }),
      ),
    )

    const searchBar = el(
      'button',
      {
        class: 'field m-search',
        type: 'button',
        style: { width: '100%', textAlign: 'left' },
        onclick: () => setState({ view: 'search' }, true),
      },
      el('span', { style: { color: 'var(--ink-45)', fontSize: '15px' }, text: '⌕' }),
      el('span', {
        class: 'grow',
        style: { color: 'var(--ink-42)', fontSize: '16px' },
        text: state.q || 'find a book, author, note…',
      }),
    )

    mount(
      head,
      top,
      searchBar,
      state.view === 'room' ? mobileChips(counts, paintBody) : null,
    )
  }

  const paintBody = () => {
    const state = getState()

    if (state.view === 'search') {
      mount(body, mobileSearch({ onSelect: openSheet }))
    } else if (state.view === 'wishlist') {
      mount(body, wishlistView({ onSelect: openSheet, mobile: true }))
    } else if (state.view === 'notes') {
      mount(body, notesView({ onSelect: openSheet, mobile: true }))
    } else {
      mount(
        body,
        mobileRoom({
          onSelect: (spine) => openSheet(spine.id),
          onOpenFilters: () => openFilterDrawer(paintBody, true),
        }),
      )
    }
  }

  const paintTabs = () => {
    const state = getState()
    mount(
      tabbar,
      TABS.map((tab) =>
        el(
          'button',
          {
            class: `tab${state.view === tab.key ? ' is-on' : ''}`,
            type: 'button',
            onclick: () => {
              closeSheet()
              setState({ view: tab.key }, true)
            },
          },
          el('span', { class: 'tab-glyph', text: tab.glyph }),
          el('span', { class: 'tab-label', text: tab.label }),
        ),
      ),
    )
  }

  mount(app, el('div', { class: 'glow' }), el('div', { class: 'app-mobile' }, head, body, tabbar))

  const refreshCounts = async () => {
    try {
      const room = await api.room(getState().collection, 1, 0)
      counts = room.counts
      if (getState().view === 'room') paintHead()
    } catch {}
  }

  paintHead()
  paintBody()
  paintTabs()
  void refreshCounts()

  if (getState().book) openSheet(getState().book as number)

  const unsubscribe = subscribe((next, previous) => {
    if (next.view !== previous.view) {
      paintHead()
      paintBody()
      paintTabs()
    } else if (
      next.collection !== previous.collection ||
      next.status !== previous.status ||
      JSON.stringify(next.filters) !== JSON.stringify(previous.filters)
    ) {
      paintHead()
      paintBody()
      if (next.collection !== previous.collection) void refreshCounts()
    }
  })

  const unlisten = onLibraryChanged(() => {
    invalidateFacets()
    void refreshCounts()
    paintBody()
  })

  return () => {
    unsubscribe()
    unlisten()
    closeSheet()
  }
}
