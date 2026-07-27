import { api } from '../api.ts'
import { facetChips, resultRows, resultSummary } from '../components/searchResults.ts'
import { el, mount } from '../dom.ts'
import { getState, setFilters, setState } from '../store.ts'
import type { Facet } from '../types.ts'

type Options = {
  onSelect: (bookId: number) => void
}

export function mobileSearch(options: Options): HTMLElement {
  const root = el('div', { class: 'm-body', style: { gap: '0' } })
  const chipHost = el('div', { class: 'm-facets' })
  const summary = el('div', { class: 'mono', style: { padding: '6px 20px 12px' } })
  const results = el('div', { style: { flex: '1' } })

  const input = el('input', {
    value: getState().q,
    placeholder: 'find a book, author, note…',
    autocomplete: 'off',
  })

  const run = async () => {
    const term = input.value.trim()
    const facet = getState().facet

    if (!term) {
      mount(results, el('p', { class: 'empty', style: { padding: '20px' } }, 'Search titles, authors and your own notes.'))
      mount(chipHost)
      summary.textContent = ''
      return
    }

    try {
      const found = await api.search(term, facet)
      summary.textContent = resultSummary(found.term, found.counts)
      mount(
        chipHost,
        facetChips(facet, found.counts, (next: Facet) => {
          setState({ facet: next })
          void run()
        }),
      )

      if (found.items.length === 0) {
        mount(results, el('p', { class: 'empty', style: { padding: '20px' } }, 'Nothing here.'))
        return
      }

      mount(
        results,
        resultRows(facet, found.items, {
          onBook: options.onSelect,
          onAuthor: (id) => {
            setFilters({ authorId: id })
            setState({ view: 'room', collection: null })
          },
        }),
      )
    } catch {
      mount(results, el('p', { class: 'empty', style: { padding: '20px' } }, 'Search failed.'))
    }
  }

  let debounce: number | undefined
  input.addEventListener('input', () => {
    setState({ q: input.value })
    window.clearTimeout(debounce)
    debounce = window.setTimeout(() => void run(), 260)
  })

  mount(
    root,
    el(
      'div',
      { class: 'm-searchbar' },
      el(
        'div',
        { class: 'field' },
        el('span', { style: { color: 'var(--accent)', fontSize: '15px' }, text: '⌕' }),
        input,
      ),
      el('button', {
        class: 'btn btn-quiet',
        type: 'button',
        style: { fontSize: '16px' },
        text: 'Cancel',
        onclick: () => {
          setState({ q: '', view: 'room' })
        },
      }),
    ),
    chipHost,
    summary,
    results,
  )

  void run()
  setTimeout(() => input.focus(), 60)

  return root
}
