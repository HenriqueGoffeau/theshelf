export function normalizeIsbn(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.replace(/[\s-]/g, '').toUpperCase()
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 10; i += 1) {
    const char = isbn[i] as string
    const digit = char === 'X' ? 10 : Number(char)
    sum += digit * (10 - i)
  }
  return sum % 11 === 0
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 13; i += 1) {
    sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3)
  }
  return sum % 10 === 0
}

export function isValidIsbn(isbn: string): boolean {
  return isValidIsbn10(isbn) || isValidIsbn13(isbn)
}

export function toIsbn13(isbn: string): string | null {
  if (isValidIsbn13(isbn)) return isbn
  if (!isValidIsbn10(isbn)) return null

  const core = `978${isbn.slice(0, 9)}`
  let sum = 0
  for (let i = 0; i < 12; i += 1) {
    sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3)
  }
  const check = (10 - (sum % 10)) % 10
  return `${core}${check}`
}

export function toIsbn10(isbn: string): string | null {
  if (isValidIsbn10(isbn)) return isbn
  if (!isValidIsbn13(isbn) || !isbn.startsWith('978')) return null

  const core = isbn.slice(3, 12)
  let sum = 0
  for (let i = 0; i < 9; i += 1) {
    sum += Number(core[i]) * (10 - i)
  }
  const remainder = (11 - (sum % 11)) % 11
  return `${core}${remainder === 10 ? 'X' : remainder}`
}

export function splitIsbns(isbn: string): { isbn13: string | null; isbn10: string | null } {
  return { isbn13: toIsbn13(isbn), isbn10: toIsbn10(isbn) }
}
