import { createHmac, createHash, scryptSync, timingSafeEqual } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import { config } from './config.ts'
import { parseCookies, unauthorized, type Ctx } from './http.ts'

const COOKIE_NAME = 'mylibrary_session'
const SESSION_MS = 24 * 60 * 60 * 1000

const signingKey = scryptSync(config.appPassword, 'mylibrary.session.v1', 32)

function sign(value: string): string {
  return createHmac('sha256', signingKey).update(value).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function checkPassword(candidate: unknown): boolean {
  if (typeof candidate !== 'string' || candidate.length === 0) return false
  return safeEqual(candidate, config.appPassword)
}

function createToken(): string {
  const payload = String(Date.now() + SESSION_MS)
  return `${payload}.${sign(payload)}`
}

function verifyToken(token: string | undefined): boolean {
  if (!token) return false
  const dot = token.lastIndexOf('.')
  if (dot === -1) return false

  const payload = token.slice(0, dot)
  const signature = token.slice(dot + 1)
  if (!safeEqual(signature, sign(payload))) return false

  const expiresAt = Number(payload)
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

function cookieAttributes(maxAgeSeconds: number): string {
  const attrs = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`]
  if (config.secureCookie) attrs.push('Secure')
  return attrs.join('; ')
}

export function setSessionCookie(res: ServerResponse): void {
  res.setHeader('set-cookie', `${COOKIE_NAME}=${createToken()}; ${cookieAttributes(SESSION_MS / 1000)}`)
}

export function clearSessionCookie(res: ServerResponse): void {
  res.setHeader('set-cookie', `${COOKIE_NAME}=; ${cookieAttributes(0)}`)
}

export function isAuthenticated(ctx: Pick<Ctx, 'req'>): boolean {
  const cookies = parseCookies(ctx.req.headers.cookie)
  return verifyToken(cookies[COOKIE_NAME])
}

export function requireAuth(ctx: Pick<Ctx, 'req'>): void {
  if (!isAuthenticated(ctx)) throw unauthorized()
}
