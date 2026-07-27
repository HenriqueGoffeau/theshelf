import { el } from './dom.ts'

type Kind = 'good' | 'error' | 'info'

const host = document.getElementById('toasts') as HTMLElement

export function toast(message: string, kind: Kind = 'good'): void {
  const node = el('div', {
    class: `toast${kind === 'error' ? ' toast-error' : kind === 'info' ? ' toast-info' : ''}`,
    text: message,
    role: 'status',
  })

  host.appendChild(node)

  setTimeout(() => {
    node.style.transition = 'opacity .3s ease, transform .3s ease'
    node.style.opacity = '0'
    node.style.transform = 'translateY(6px)'
    setTimeout(() => node.remove(), 320)
  }, 3600)
}

export function toastError(err: unknown): void {
  const message = err instanceof Error ? err.message : 'Something went wrong'
  toast(message, 'error')
}
