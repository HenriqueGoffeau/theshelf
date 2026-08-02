import { badRequest } from './http.ts'

export function optionalString(
  value: unknown,
  field: string,
  maxLength = 2000,
): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') throw badRequest(`${field} must be text`)
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (trimmed.length > maxLength) throw badRequest(`${field} is too long (max ${maxLength})`)
  return trimmed
}

export function requiredString(value: unknown, field: string, maxLength = 500): string {
  const parsed = optionalString(value, field, maxLength)
  if (!parsed) throw badRequest(`${field} is required`)
  return parsed
}

export function optionalInt(
  value: unknown,
  field: string,
  min: number,
  max: number,
): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed)) throw badRequest(`${field} must be a whole number`)
  if (parsed < min || parsed > max) throw badRequest(`${field} must be between ${min} and ${max}`)
  return parsed
}

export function optionalEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw badRequest(`${field} must be one of: ${allowed.join(', ')}`)
  }
  return value as T
}

export function nullableEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw badRequest(`${field} must be one of: ${allowed.join(', ')}`)
  }
  return value as T
}

export function optionalDate(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw badRequest(`${field} must be a date like 2024-05-17`)
  }
  return value
}

export function stringList(value: unknown, field: string, maxItems = 50): string[] | undefined {
  if (value === undefined) return undefined
  if (value === null) return []
  if (!Array.isArray(value)) throw badRequest(`${field} must be a list`)
  if (value.length > maxItems) throw badRequest(`${field} has too many entries (max ${maxItems})`)

  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') throw badRequest(`${field} must contain only text`)
    const trimmed = entry.trim()
    if (!trimmed) continue
    if (trimmed.length > 200) throw badRequest(`${field} entries must be under 200 characters`)
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

export function idParam(value: string | undefined, field = 'id'): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) throw badRequest(`${field} must be a positive number`)
  return parsed
}

export function queryInt(
  query: URLSearchParams,
  key: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const raw = query.get(key)
  if (raw === null || raw === '') return fallback
  const parsed = Number(raw)
  if (!Number.isInteger(parsed)) throw badRequest(`${key} must be a whole number`)
  return Math.min(Math.max(parsed, min), max)
}
