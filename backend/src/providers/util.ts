import { config } from '../config.ts'

const USER_AGENT = 'MyLibrary/0.1 (personal book catalogue; self-hosted)'

export async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(config.lookupTimeoutMs),
    })
    if (!response.ok) {
      if (response.status !== 404) {
        const hint =
          response.status === 429
            ? ' — shared anonymous quota is spent; set GOOGLE_BOOKS_API_KEY for a private one'
            : ''
        console.warn(`[lookup] ${url} responded ${response.status}${hint}`)
      }
      return null
    }
    return (await response.json()) as T
  } catch (err) {
    console.warn(`[lookup] ${url} failed:`, err instanceof Error ? err.message : err)
    return null
  }
}

export function firstYear(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value !== 'string') return null
  const match = value.match(/\b(1[0-9]{3}|20[0-9]{2}|21[0-9]{2})\b/)
  return match ? Number(match[1]) : null
}

export function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.replace(/\s+/g, ' ').trim()
  return trimmed.length > 0 ? trimmed : null
}

export function longText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function positiveInt(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const SUBJECT_NOISE = [
  'accessible book',
  'protected daisy',
  'in library',
  'overdrive',
  'internet archive',
  'lending library',
  'large type',
  'nyt:',
  'new york times bestseller',
  'open_syllabus',
  'reading level',
  'popular print disabled',
  'ol_',
]

export function tidyGenres(values: unknown, limit = 8): string[] {
  if (!Array.isArray(values)) return []

  const seen = new Set<string>()
  const out: string[] = []

  for (const raw of values) {
    const name = cleanText(typeof raw === 'string' ? raw : (raw as { name?: unknown })?.name)
    if (!name) continue

    const lower = name.toLowerCase()
    if (name.length > 40) continue
    if (name.includes('--') || name.includes('/')) continue
    if (/\d{4}/.test(name)) continue
    if (SUBJECT_NOISE.some((noise) => lower.includes(noise))) continue
    if (seen.has(lower)) continue

    seen.add(lower)
    out.push(titleCase(name))
    if (out.length >= limit) break
  }

  return out
}

export function titleCase(value: string): string {
  return value
    .split(' ')
    .map((word) => (word.length > 2 ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(' ')
}
