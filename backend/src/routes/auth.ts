import {
  checkPassword,
  clearSessionCookie,
  isAuthenticated,
  setSessionCookie,
} from '../auth.ts'
import { HttpError, readJson, type Ctx, type Router } from '../http.ts'

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 8

const attempts = new Map<string, { count: number; firstAt: number }>()

function clientKey(ctx: Ctx): string {
  const forwarded = ctx.req.headers['x-forwarded-for']
  const header = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return header?.split(',')[0]?.trim() || ctx.req.socket.remoteAddress || 'unknown'
}

function throttle(key: string): void {
  const record = attempts.get(key)
  if (!record) return
  if (Date.now() - record.firstAt > WINDOW_MS) {
    attempts.delete(key)
    return
  }
  if (record.count >= MAX_ATTEMPTS) {
    const minutes = Math.ceil((WINDOW_MS - (Date.now() - record.firstAt)) / 60_000)
    throw new HttpError(429, `Too many attempts. Try again in ${minutes} minute(s).`)
  }
}

function recordFailure(key: string): void {
  const record = attempts.get(key)
  if (!record || Date.now() - record.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() })
    return
  }
  record.count += 1
}

export function registerAuthRoutes(router: Router): void {
  router.get('/api/health', () => ({ ok: true }), { public: true })

  router.get('/api/auth/session', (ctx: Ctx) => ({ authenticated: isAuthenticated(ctx) }), {
    public: true,
  })

  router.post(
    '/api/auth/login',
    async (ctx: Ctx) => {
      const key = clientKey(ctx)
      throttle(key)

      const body = await readJson<{ password?: unknown }>(ctx.req)
      if (!checkPassword(body.password)) {
        recordFailure(key)
        throw new HttpError(401, 'That is not the right password')
      }

      attempts.delete(key)
      setSessionCookie(ctx.res)
      return { authenticated: true }
    },
    { public: true },
  )

  router.post(
    '/api/auth/logout',
    (ctx: Ctx) => {
      clearSessionCookie(ctx.res)
      return { authenticated: false }
    },
    { public: true },
  )
}
