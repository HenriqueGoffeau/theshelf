import { api } from '../api.ts'
import { el, mount } from '../dom.ts'
import { setFilters, setState } from '../store.ts'
import type { Facet } from '../types.ts'
import { openOverlay } from './overlay.ts'
import { facetChips, resultRows, resultSummary } from './searchResults.ts'

let open = false

export function openPalette(initialTerm: string, onPickBook: (id: number) => void): void {
  if (open) return
  open = true

  let facet: Facet = 'books'
  let term = initialTerm

  const input = el('input', { value: term, placeholder: 'find a book, author, note…' })
  const chipHost = el('div', { class: 'palette-facets' })
  const results = el('div', { class: 'palette-results' })
  const summary = el('div', { class: 'mono', style: { padding: '10px 20px 0' } })

  const close = openOverlay({
    onClose: () => {
      open = false
    },
    content: (dismiss) =>
      el(
        'div',
        {
          class: 'palette-wrap',
          onclick: (event: MouseEvent) => {
            if (event.target === event.currentTarget) dismiss()
          },
        },
        el(
          'div',
          { class: 'palette' },
          el(
            'div',
            { class: 'palette-field' },
            el('span', { style: { color: 'var(--ink-45)' }, text: '⌕' }),
            input,
            el('span', { class: 'kbd', text: 'ESC' }),
          ),
          chipHost,
          summary,
          results,
        ),
      ),
  })

  const run = async () => {
    if (!term.trim()) {
      mount(results, el('p', { class: 'empty', style: { padding: '20px' } }, 'Type to search the room.'))
      mount(chipHost)
      summary.textContent = ''
      return
    }

    try {
      const found = await api.search(term, facet)
      summary.textContent = resultSummary(found.term, found.counts)
      mount(chipHost, facetChips(facet, found.counts, (next) => {
        facet = next
        void run()
      }))

      if (found.items.length === 0) {
        mount(results, el('p', { class: 'empty', style: { padding: '20px' } }, 'Nothing here.'))
        return
      }

      mount(
        results,
        resultRows(facet, found.items, {
          onBook: (id) => {
            onPickBook(id)
            close()
          },
          onAuthor: (id) => {
            setFilters({ authorId: id })
            setState({ view: 'room', collection: null })
            close()
          },
        }),
      )
    } catch {
      mount(results, el('p', { class: 'empty', style: { padding: '20px' } }, 'Search failed.'))
    }
  }

  let debounce: number | undefined
  input.addEventListener('input', () => {
    term = input.value
    window.clearTimeout(debounce)
    debounce = window.setTimeout(() => void run(), 220)
  })

  input.focus()
  input.select()
  void run()
}

export function bindPaletteShortcut(onPickBook: (id: number) => void): void {
  window.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      openPalette('', onPickBook)
    }
  })
}
