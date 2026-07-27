import { el } from '../dom.ts'

type OverlayOptions = {
  content: (close: () => void) => HTMLElement
  className?: string
  backdropClass?: string
  onClose?: () => void
  closeOnBackdrop?: boolean
  stack?: boolean
}

const openOverlays = new Set<() => void>()

export function closeAllOverlays(): void {
  for (const dismiss of [...openOverlays]) dismiss()
}

export function openOverlay(options: OverlayOptions): () => void {
  if (!options.stack) {
    for (const dismiss of [...openOverlays]) dismiss()
  }

  let closed = false

  const close = () => {
    if (closed) return
    closed = true
    openOverlays.delete(close)
    backdrop.remove()
    panel.remove()
    document.removeEventListener('keydown', onKey)
    options.onClose?.()
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      close()
    }
  }

  const backdrop = el('div', {
    class: `backdrop${options.backdropClass ? ` ${options.backdropClass}` : ''}`,
    onclick: () => {
      if (options.closeOnBackdrop !== false) close()
    },
  })

  const panel = options.content(close)
  if (options.className) panel.classList.add(...options.className.split(' '))

  document.body.appendChild(backdrop)
  document.body.appendChild(panel)
  document.addEventListener('keydown', onKey)
  openOverlays.add(close)

  const focusTarget =
    panel.querySelector<HTMLElement>('input:not([type=hidden]), textarea') ??
    panel.querySelector<HTMLElement>('button')
  focusTarget?.focus()

  return close
}

type PopoverOptions = {
  anchor: HTMLElement
  content: (close: () => void) => HTMLElement
  align?: 'start' | 'end'
  onClose?: () => void
}

const GUTTER = 12
const OFFSET = 8

export function openPopover(options: PopoverOptions): () => void {
  let node: HTMLElement | null = null

  const place = () => {
    if (!node) return
    const anchor = options.anchor.getBoundingClientRect()
    const width = node.offsetWidth
    const height = node.offsetHeight
    const view = { w: window.innerWidth, h: window.innerHeight }

    const wanted = options.align === 'end' ? anchor.right - width : anchor.left
    const left = Math.min(Math.max(GUTTER, wanted), Math.max(GUTTER, view.w - width - GUTTER))

    let top = anchor.bottom + OFFSET
    if (top + height > view.h - GUTTER) {
      const above = anchor.top - OFFSET - height
      top = above >= GUTTER ? above : Math.max(GUTTER, view.h - height - GUTTER)
    }

    node.style.left = `${Math.round(left)}px`
    node.style.top = `${Math.round(top)}px`
  }

  const observer = new ResizeObserver(place)

  return openOverlay({
    backdropClass: 'backdrop-clear',
    onClose: () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      options.anchor.classList.remove('is-open')
      options.onClose?.()
    },
    content: (close) => {
      node = options.content(close)
      node.classList.add('popover')
      options.anchor.classList.add('is-open')
      observer.observe(node)
      window.addEventListener('resize', place)
      window.addEventListener('scroll', place, true)
      requestAnimationFrame(place)
      return node
    },
  })
}

export function modal(
  title: string,
  body: HTMLElement,
  actions?: (close: () => void) => (HTMLElement | null)[],
): (close: () => void) => HTMLElement {
  return (close) => {
    const buttons = actions?.(close).filter(Boolean) ?? []
    return el(
      'div',
      { class: 'modal' },
      el(
        'div',
        { class: 'row spread' },
        el('h2', { class: 'modal-title', text: title }),
        el('button', { class: 'btn btn-quiet', type: 'button', text: '✕', onclick: close }),
      ),
      body,
      buttons.length > 0 ? el('div', { class: 'modal-actions' }, buttons) : null,
    )
  }
}

export function confirmDialog(title: string, message: string, confirmLabel = 'Yes'): Promise<boolean> {
  return new Promise((resolve) => {
    let answer = false
    openOverlay({
      stack: true,
      onClose: () => resolve(answer),
      content: (close) =>
        el(
          'div',
          { class: 'modal' },
          el('h2', { class: 'modal-title', text: title }),
          el('p', { class: 'empty', text: message }),
          el(
            'div',
            { class: 'modal-actions' },
            el('button', { class: 'btn', type: 'button', text: 'Never mind', onclick: close }),
            el('button', {
              class: 'btn btn-danger',
              type: 'button',
              text: confirmLabel,
              onclick: () => {
                answer = true
                close()
              },
            }),
          ),
        ),
    })
  })
}
