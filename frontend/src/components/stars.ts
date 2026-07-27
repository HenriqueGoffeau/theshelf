import { el } from '../dom.ts'

export function starPicker(
  initial: number | null,
  onChange: (rating: number | null) => void,
): HTMLElement {
  let value = initial
  const wrap = el('span', { class: 'stars' })
  const buttons: HTMLButtonElement[] = []

  const paint = (preview: number | null) => {
    const shown = preview ?? value ?? 0
    buttons.forEach((button, index) => {
      button.className = index < shown ? 'is-on' : ''
    })
  }

  for (let i = 1; i <= 5; i += 1) {
    const button = el('button', {
      type: 'button',
      text: '★',
      'aria-label': `${i} star${i === 1 ? '' : 's'}`,
      onclick: () => {
        value = value === i ? null : i
        paint(null)
        onChange(value)
      },
      onmouseenter: () => paint(i),
      onmouseleave: () => paint(null),
    })
    buttons.push(button)
    wrap.appendChild(button)
  }

  paint(null)
  return wrap
}

export function starsStatic(rating: number | null): HTMLElement {
  const wrap = el('span', { class: 'stars' })
  for (let i = 1; i <= 5; i += 1) {
    wrap.appendChild(el('span', { class: i <= (rating ?? 0) ? 'is-on' : '', text: '★' }))
  }
  return wrap
}
