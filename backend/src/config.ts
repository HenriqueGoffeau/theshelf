try {
  process.loadEnvFile()
} catch {}

function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    console.error(`Missing required environment variable: ${name}`)
    process.exit(1)
  }
  return value
}

function number(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

const DEV_DATABASE_URL = 'postgres://postgres:postgres@localhost:5432/mylibrary'

export const config = {
  port: number('PORT', 3000),
  databaseUrl: process.env.DATABASE_URL ?? DEV_DATABASE_URL,
  appPassword: required('APP_PASSWORD'),
  googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY ?? '',
  corsOrigin: process.env.CORS_ORIGIN ?? '',
  secureCookie: process.env.SECURE_COOKIE === 'true',
  lookupTimeoutMs: number('LOOKUP_TIMEOUT_MS', 8000),
}
