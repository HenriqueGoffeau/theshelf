export const ACCENTS = [
  { key: 'gold', label: 'Gold', swatch: '#d9a441' },
  { key: 'terracotta', label: 'Terracotta', swatch: '#c0603f' },
  { key: 'sage', label: 'Sage', swatch: '#8fa37e' },
  { key: 'stone', label: 'Stone', swatch: '#b9aea0' },
] as const

export type AccentKey = (typeof ACCENTS)[number]['key']

const ACCENT_STORE = 'shelf.accent'

function read(key: string, fallback: string, allowed: readonly string[]): string {
  try {
    const value = window.localStorage.getItem(key)
    return value && allowed.includes(value) ? value : fallback
  } catch {
    return fallback
  }
}

export function getAccent(): AccentKey {
  return read(ACCENT_STORE, 'gold', ACCENTS.map((a) => a.key)) as AccentKey
}

function persist(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {}
}

export function setAccent(value: AccentKey): void {
  persist(ACCENT_STORE, value)
  document.documentElement.dataset.accent = value
}

export function applyTheme(): void {
  document.documentElement.dataset.accent = getAccent()
}
