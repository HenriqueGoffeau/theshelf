import { api, ApiError } from './api.ts'
import { el, mount } from './dom.ts'

export function renderGate(app: HTMLElement, onOpened: () => void): void {
  const password = el('input', {
    type: 'password',
    placeholder: '· · · · · · · ·',
    autocomplete: 'current-password',
    style: { textAlign: 'center', letterSpacing: '0.3em', fontSize: '16px' },
  })

  const error = el('div', {
    class: 'mono',
    style: { color: '#e0a08c', textAlign: 'center', minHeight: '14px' },
  })

  const submit = el('button', {
    class: 'btn btn-accent',
    type: 'submit',
    style: { width: '100%', justifyContent: 'center', padding: '13px' },
    text: 'Open the room',
  })

  const form = el(
    'form',
    { class: 'stack', style: { gap: '16px', width: '100%' } },
    el('div', { class: 'field', style: { padding: '12px 18px' } }, password),
    error,
    submit,
  )

  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    error.textContent = ''
    submit.disabled = true
    submit.textContent = 'Unlocking…'

    try {
      await api.login(password.value)
      onOpened()
    } catch (err) {
      error.textContent = err instanceof ApiError ? err.message : 'Could not reach the library'
      password.value = ''
      password.focus()
    } finally {
      submit.disabled = false
      submit.textContent = 'Open the room'
    }
  })

  mount(
    app,
    el('div', { class: 'glow' }),
    el(
      'div',
      {
        style: {
          position: 'relative',
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
        },
      },
      el(
        'div',
        {
          class: 'stack',
          style: {
            width: 'min(380px, 100%)',
            gap: '26px',
            alignItems: 'center',
            padding: '38px 34px 34px',
            border: '1px solid var(--ink-16)',
            borderRadius: '14px',
            background: 'rgba(0,0,0,.22)',
            boxShadow: '0 40px 80px -30px rgba(0,0,0,.85)',
          },
        },
        el(
          'div',
          { class: 'stack', style: { gap: '8px', alignItems: 'center' } },
          el('div', {
            class: 'wordmark',
            style: { fontSize: '26px', color: 'var(--accent)' },
            text: 'THE SHELF',
          }),
          el('div', { class: 'mono', text: 'a quiet room for the books you keep' }),
        ),
        form,
      ),
    ),
  )

  password.focus()
}
