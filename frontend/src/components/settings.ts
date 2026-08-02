import { api } from '../api.ts'
import { el } from '../dom.ts'
import { ACCENTS, getAccent, setAccent } from '../theme.ts'
import type { AccentKey } from '../theme.ts'
import { modal, openOverlay } from './overlay.ts'

export function openSettings(onSignedOut: () => void): void {
  const accentRow = el('div', { class: 'row wrap', style: { gap: '8px' } })

  const paintAccents = () => {
    accentRow.replaceChildren(
      ...ACCENTS.map((accent) =>
        el(
          'button',
          {
            class: `chip${getAccent() === accent.key ? ' is-on' : ''}`,
            type: 'button',
            onclick: () => {
              setAccent(accent.key as AccentKey)
              paintAccents()
            },
          },
          el('span', {
            class: 'chip-dot',
            style: { '--dot': accent.swatch, width: '10px', height: '10px' } as Record<string, string>,
          }),
          el('span', { text: accent.label }),
        ),
      ),
    )
  }

  paintAccents()

  openOverlay({
    className: 'modal-roomy',
    content: modal(
      'The room',
      el(
        'div',
        { class: 'stack', style: { gap: '18px' } },
        el(
          'div',
          { class: 'stack', style: { gap: '8px' } },
          el('span', { class: 'label', text: 'accent' }),
          accentRow,
        ),
      ),
      (close) => [
        el('button', {
          class: 'btn btn-danger',
          type: 'button',
          text: 'Close the library',
          onclick: async () => {
            close()
            try {
              await api.logout()
            } catch {}
            onSignedOut()
          },
        }),
      ],
    ),
  })
}
