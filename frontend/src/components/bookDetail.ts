import { api, coverProxy } from '../api.ts'
import { normalizeHex, sampleCoverColour } from '../colour.ts'
import { el, mount } from '../dom.ts'
import { libraryChanged } from '../events.ts'
import { STATUS_LABEL, noteMeta } from '../format.ts'
import { toast, toastError } from '../toast.ts'
import type { Book, Note, ReadingStatus, SpineInk } from '../types.ts'
import { confirmDialog, modal, openOverlay } from './overlay.ts'
import { shelvePicker } from './shelvePicker.ts'
import { spineNode } from './spine.ts'
import { starPicker } from './stars.ts'

const STATUS_CHOICES: ReadingStatus[] = ['reading', 'finished', 'aside']

const INK_CHOICES: { key: SpineInk; label: string }[] = [
  { key: 'light', label: 'White' },
  { key: 'dark', label: 'Black' },
]

type Variant = 'panel' | 'sheet'

type DetailOptions = {
  bookId: number
  variant: Variant
  onChanged?: () => void
  onClose?: () => void
}

export type DetailHandle = {
  node: HTMLElement
  footer: HTMLElement
  refresh: () => Promise<void>
}

export function bookDetail(options: DetailOptions): DetailHandle {
  const root = el('div', { class: 'stack', style: { gap: '20px', flex: '1', minHeight: '0' } })
  const footer = el('div', { class: options.variant === 'sheet' ? 'sheet-foot' : 'note-composer' })

  let book: Book | null = null
  let notes: Note[] = []
  let sampled = false

  const refresh = async () => {
    const [loaded, feed] = await Promise.all([
      api.book(options.bookId),
      api.notes({ bookId: options.bookId, limit: 60 }),
    ])
    book = loaded
    notes = feed.items
    paint()
    void maybeSampleCover()
  }

  const maybeSampleCover = async () => {
    if (sampled || !book || !book.spineAuto || !book.coverUrl) return
    sampled = true
    const colour = await sampleCoverColour(book.coverUrl)
    if (!colour || !book) return
    try {
      book = await api.updateBook(book.id, { spineColor: colour })
      libraryChanged()
      paint()
    } catch {
    }
  }

  const save = async (patch: Parameters<typeof api.updateBook>[1], note?: string) => {
    if (!book) return
    try {
      book = await api.updateBook(book.id, patch)
      libraryChanged()
      options.onChanged?.()
      if (note) toast(note)
      paint()
    } catch (err) {
      toastError(err)
    }
  }

  const addNote = async (input: HTMLInputElement, pageInput?: HTMLInputElement) => {
    const text = input.value.trim()
    if (!text || !book) return
    const page = pageInput?.value ? Number(pageInput.value) : null
    try {
      await api.addNote(book.id, { text, page: Number.isInteger(page) ? page : null })
      input.value = ''
      if (pageInput) pageInput.value = ''
      const feed = await api.notes({ bookId: book.id, limit: 60 })
      notes = feed.items
      libraryChanged()
      paint()
    } catch (err) {
      toastError(err)
    }
  }

  function coverNode(): HTMLElement {
    if (!book) return el('div')
    const size = options.variant === 'panel' ? { w: 116, h: 174 } : { w: 112, h: 168 }

    if (!book.coverUrl) {
      return el(
        'div',
        {
          class: 'cover-blank',
          style: { width: `${size.w}px`, height: `${size.h}px`, flex: 'none' },
        },
      )
    }

    return el('img', {
      class: 'cover',
      src: coverProxy(book.coverUrl),
      alt: `Cover of ${book.title}`,
      style: { width: `${size.w}px`, height: `${size.h}px`, flex: 'none' },
      onerror: (event: Event) => {
        const img = event.currentTarget as HTMLImageElement
        img.replaceWith(
          el('div', {
            class: 'cover-blank',
            style: { width: `${size.w}px`, height: `${size.h}px`, flex: 'none' },
          }),
        )
      },
    })
  }

  function statusControl(): HTMLElement {
    if (!book) return el('div')

    if (options.variant === 'sheet') {
      return el(
        'div',
        { class: 'segment' },
        STATUS_CHOICES.map((status) =>
          el('button', {
            type: 'button',
            class: book!.readingStatus === status ? 'is-on' : '',
            text: STATUS_LABEL[status],
            onclick: () =>
              void save({ readingStatus: book!.readingStatus === status ? 'unread' : status }),
          }),
        ),
      )
    }

    return el(
      'div',
      { class: 'status-row' },
      STATUS_CHOICES.map((status) =>
        el('button', {
          type: 'button',
          class: `status-option${book!.readingStatus === status ? ' is-on' : ''}`,
          text: STATUS_LABEL[status],
          onclick: () =>
            void save({ readingStatus: book!.readingStatus === status ? 'unread' : status }),
        }),
      ),
    )
  }

  function paintComposer(): void {
    const isSheet = options.variant === 'sheet'

    const pageInput = el('input', {
      type: 'number',
      min: '1',
      placeholder: 'p.',
      style: { width: '52px', flex: 'none', fontSize: '13px' },
    })
    const input = el('input', {
      placeholder: 'Write a note…',
      onkeydown: (event: KeyboardEvent) => {
        if (event.key === 'Enter') void addNote(input, pageInput)
      },
    })

    const send = el('button', {
      class: isSheet ? 'send-round' : 'send',
      type: 'button',
      text: isSheet ? '↑' : 'ADD NOTE',
      'aria-label': isSheet ? 'Add note' : null,
      disabled: true,
      onclick: () => void addNote(input, pageInput),
    })

    input.addEventListener('input', () => {
      send.disabled = input.value.trim() === ''
    })

    if (isSheet) {
      mount(footer, input, send)
      return
    }

    mount(footer, pageInput, input, send)
  }

  function noteNode(note: Note): HTMLElement {
    return el(
      'div',
      { class: 'note-entry' },
      el(
        'div',
        { class: 'row spread', style: { gap: '8px' } },
        el('span', { class: 'note-meta', text: noteMeta(note) }),
        el('button', {
          class: 'note-meta',
          type: 'button',
          text: '✕',
          title: 'Delete this note',
          onclick: async () => {
            const yes = await confirmDialog('Delete this note?', note.text.slice(0, 120), 'Delete')
            if (!yes) return
            try {
              await api.deleteNote(note.id)
              notes = notes.filter((entry) => entry.id !== note.id)
              libraryChanged()
              paint()
            } catch (err) {
              toastError(err)
            }
          },
        }),
      ),
      el('div', { class: 'note-text', text: note.text }),
    )
  }

  function editFeedback(): void {
    if (!book) return
    const current = book
    let rating = current.rating

    const text = el('textarea', {
      class: 'input-block',
      value: current.feedback ?? '',
      placeholder: 'What did the whole book leave you with?',
    })

    openOverlay({
      content: modal(
        'Your verdict',
        el(
          'div',
          { class: 'stack' },
          el(
            'div',
            { class: 'form-field' },
            el('span', { class: 'label', text: 'Rating' }),
            el(
              'div',
              { class: 'row', style: { gap: '10px', alignItems: 'center' } },
              starPicker(current.rating, (value) => {
                rating = value
              }),
            ),
          ),
          el(
            'label',
            { class: 'form-field' },
            el('span', { class: 'label', text: 'Feedback' }),
            text,
          ),
        ),
        (close) => [
          current.feedback
            ? el('button', {
                class: 'btn btn-danger',
                type: 'button',
                text: 'Clear',
                onclick: async () => {
                  await save({ rating, feedback: null }, 'Feedback cleared')
                  close()
                },
              })
            : null,
          el('button', {
            class: 'btn btn-accent',
            type: 'button',
            text: 'Save',
            onclick: async () => {
              await save({ rating, feedback: text.value.trim() || null }, 'Feedback saved')
              close()
            },
          }),
        ],
      ),
    })
  }

  function editDetails(): void {
    if (!book) return
    const current = book

    const title = el('input', { class: 'input-block', value: current.title, oninput: () => paintPreview() })
    const authors = el('input', {
      class: 'input-block',
      value: current.authors.map((a) => a.name).join(', '),
    })
    const publisher = el('input', { class: 'input-block', value: current.publisher ?? '' })
    const year = el('input', { class: 'input-block', type: 'number', value: current.publishedYear ?? '' })
    const pages = el('input', { class: 'input-block', type: 'number', value: current.pageCount ?? '' })
    const language = el('input', { class: 'input-block', value: current.language ?? '' })
    const genres = el('input', { class: 'input-block', value: current.genres.map((g) => g.name).join(', ') })
    const stage = el('div', { class: 'spine-stage' })

    const colour = el('input', {
      type: 'color',
      class: 'hex-picker',
      value: current.spineColor,
      oninput: () => {
        hex.value = colour.value.toUpperCase()
        hex.classList.remove('is-bad')
        paintPreview()
      },
    })

    const hex = el('input', {
      class: 'input-block hex-input',
      value: current.spineColor.toUpperCase(),
      maxLength: 7,
      autocomplete: 'off',
      'aria-label': 'Hex colour',
      oninput: () => {
        const parsed = normalizeHex(hex.value)
        hex.classList.toggle('is-bad', parsed === null)
        if (!parsed) return
        colour.value = parsed
        paintPreview()
      },
    })

    const width = el('input', {
      class: 'input-block',
      type: 'range',
      min: '16',
      max: '60',
      value: String(current.spineWidth),
      oninput: () => paintPreview(),
    })

    let ink: SpineInk = current.spineInk
    const inkRow = el('div', { class: 'row wrap', style: { gap: '6px' } })

    const paintInk = () => {
      mount(
        inkRow,
        INK_CHOICES.map((choice) =>
          el('button', {
            class: `chip${ink === choice.key ? ' is-on' : ''}`,
            type: 'button',
            text: choice.label,
            onclick: () => {
              ink = choice.key
              paintInk()
              paintPreview()
            },
          }),
        ),
      )
    }

    function paintPreview(): void {
      const spineColor = normalizeHex(hex.value) ?? colour.value
      mount(
        stage,
        el(
          'div',
          { class: 'spine-stage-row' },
          spineNode({
            ...current,
            title: title.value.trim() || current.title,
            spineColor,
            spineInk: ink,
            spineWidth: Number(width.value),
          }),
        ),
        el('div', { class: 'plank' }),
      )
    }

    paintInk()
    paintPreview()

    const field = (label: string, control: HTMLElement) =>
      el('label', { class: 'form-field' }, el('span', { class: 'label', text: label }), control)

    const group = (label: string, control: HTMLElement) =>
      el('div', { class: 'form-field' }, el('span', { class: 'label', text: label }), control)

    openOverlay({
      content: modal(
        'Edit the entry',
        el(
          'div',
          { class: 'stack' },
          field('Title', title),
          field('Authors', authors),
          el('div', { class: 'form-grid' }, field('Publisher', publisher), field('Year', year), field('Pages', pages)),
          el('div', { class: 'form-grid' }, field('Language', language), field('Genres', genres)),
          el(
            'div',
            { class: 'stack', style: { gap: '10px' } },
            el('span', { class: 'label', text: 'Spine' }),
            el(
              'div',
              { class: 'spine-editor' },
              stage,
              el(
                'div',
                { class: 'spine-controls' },
                group('Colour', el('div', { class: 'hex-row' }, colour, hex)),
                group('Text', inkRow),
                field('Width', width),
              ),
            ),
          ),
        ),
        (close) => [
          el('button', {
            class: 'btn btn-danger',
            type: 'button',
            text: 'Remove book',
            onclick: async () => {
              const yes = await confirmDialog(
                'Remove this book?',
                `"${current.title}" and its notes go for good.`,
                'Remove it',
              )
              if (!yes) return
              try {
                await api.deleteBook(current.id)
                libraryChanged()
                toast('Off the shelf')
                close()
                options.onClose?.()
              } catch (err) {
                toastError(err)
              }
            },
          }),
          el('button', {
            class: 'btn btn-accent',
            type: 'button',
            text: 'Save',
            onclick: async () => {
              await save(
                {
                  title: title.value.trim(),
                  authors: authors.value.split(',').map((v) => v.trim()).filter(Boolean),
                  genres: genres.value.split(',').map((v) => v.trim()).filter(Boolean),
                  publisher: publisher.value.trim() || null,
                  publishedYear: year.value ? Number(year.value) : null,
                  pageCount: pages.value ? Number(pages.value) : null,
                  language: language.value.trim() || null,
                  spineColor: normalizeHex(hex.value) ?? colour.value,
                  spineInk: ink,
                  spineWidth: Number(width.value),
                },
                'Entry updated',
              )
              close()
            },
          }),
        ],
      ),
    })
  }

  function paint(): void {
    if (!book) {
      mount(root, el('div', { class: 'loading' }, el('span', { class: 'spinner' }), 'Pulling it off the shelf…'))
      return
    }

    const isSheet = options.variant === 'sheet'
    const titleClass = isSheet ? 'sheet-title' : 'panel-title'
    const bylineClass = isSheet ? 'sheet-byline' : 'panel-byline'

    const head = el(
      'div',
      { class: isSheet ? 'sheet-head' : 'panel-head' },
      coverNode(),
      el(
        'div',
        { class: 'stack', style: { gap: '8px', minWidth: '0' } },
        el('div', { class: titleClass, text: book.title }),
        el('div', {
          class: bylineClass,
          text: [book.authors[0]?.name ?? 'Author unknown', book.publishedYear]
            .filter(Boolean)
            .join(' · '),
        }),
        el(
          'div',
          { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
          starPicker(book.rating, (rating) => void save({ rating })),
          el('span', { class: 'label', text: book.rating ? 'your rating' : 'not rated yet' }),
        ),
        book.location === 'wishlist' && book.wishReason
          ? el('div', { class: 'wish-why', text: book.wishReason })
          : null,
      ),
    )

    const shelfChips = el(
      'div',
      { class: 'row wrap', style: { gap: '7px' } },
      book.shelves.map((shelf) => el('span', { class: 'chip', text: shelf.name })),
      el('button', {
        class: 'chip chip-dashed',
        type: 'button',
        text: '＋ shelve',
        onclick: () =>
          shelvePicker(book!, () => {
            void refresh()
            libraryChanged()
          }),
      }),
    )

    const feedbackSection = el(
      'div',
      { class: 'panel-section' },
      el(
        'div',
        { class: 'row spread' },
        el('span', { class: 'label', text: 'feedback' }),
        el('button', {
          class: 'label',
          type: 'button',
          text: book.feedback ? '✎ edit' : '＋ write',
          onclick: editFeedback,
        }),
      ),
      book.feedback
        ? el('p', { class: 'feedback-text', text: book.feedback })
        : el('button', {
            class: 'empty',
            type: 'button',
            style: { textAlign: 'left' },
            text: 'Nothing said about the whole of it yet. What did it leave you with?',
            onclick: editFeedback,
          }),
    )

    const notesSection = el(
      'div',
      { class: options.variant === 'panel' ? 'panel-notes' : 'stack' },
      el(
        'div',
        { class: 'row spread' },
        el('span', { class: 'label', text: `notes · ${notes.length}` }),
        el('button', {
          class: 'label',
          type: 'button',
          text: '✎ edit book',
          onclick: editDetails,
        }),
      ),
      notes.length === 0
        ? el('p', {
            class: 'empty',
            text: 'Nothing written down yet. The first note is usually the page you stopped on.',
          })
        : notes.map(noteNode),
    )

    const children = [
      el(
        'div',
        { class: 'row spread' },
        el('span', { class: 'label', text: book.location === 'wishlist' ? 'on the wishlist' : 'off the shelf' }),
        options.onClose && !isSheet
          ? el('button', { class: 'label', type: 'button', text: '✕', onclick: options.onClose })
          : null,
      ),
      head,
      book.location === 'wishlist'
        ? el('button', {
            class: 'btn btn-accent',
            type: 'button',
            text: 'Move to my shelves',
            onclick: () => void save({ location: 'owned' }, 'On your shelves now'),
          })
        : statusControl(),
      feedbackSection,
      el(
        'div',
        { class: 'panel-section' },
        el('span', { class: 'label', text: 'on shelves' }),
        shelfChips,
      ),
      notesSection,
    ]

    mount(root, children)
    paintComposer()
  }

  paint()
  void refresh().catch(toastError)

  return { node: root, footer, refresh }
}
