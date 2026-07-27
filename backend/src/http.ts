import type { IncomingMessage, ServerResponse } from 'node:http'

export class HttpError extends Error {
  status: number
  details: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.details = details
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, message, details)
export const unauthorized = (message = 'Not signed in') => new HttpError(401, message)
export const notFound = (message = 'Not found') => new HttpError(404, message)
export const conflict = (message: string, details?: unknown) => new HttpError(409, message, details)

export type Ctx = {
  req: IncomingMessage
  res: ServerResponse
  params: Record<string, string>
  query: URLSearchParams
}

export class HttpResponse {
  status: number
  body: unknown

  constructor(status: number, body: unknown) {
    this.status = status
    this.body = body
  }
}

export const created = (body: unknown) => new HttpResponse(201, body)

export const HANDLED = Symbol('response already written')

export type Handler = (ctx: Ctx) => Promise<unknown> | unknown

type Route = {
  method: string
  segments: string[]
  handler: Handler
  public: boolean
}

export class Router {
  private routes: Route[] = []

  add(method: string, pattern: string, handler: Handler, opts: { public?: boolean } = {}): void {
    this.routes.push({
      method,
      segments: pattern.split('/').filter(Boolean),
      handler,
      public: opts.public ?? false,
    })
  }

  get = (pattern: string, handler: Handler, opts?: { public?: boolean }) =>
    this.add('GET', pattern, handler, opts)
  post = (pattern: string, handler: Handler, opts?: { public?: boolean }) =>
    this.add('POST', pattern, handler, opts)
  patch = (pattern: string, handler: Handler, opts?: { public?: boolean }) =>
    this.add('PATCH', pattern, handler, opts)
  put = (pattern: string, handler: Handler, opts?: { public?: boolean }) =>
    this.add('PUT', pattern, handler, opts)
  delete = (pattern: string, handler: Handler, opts?: { public?: boolean }) =>
    this.add('DELETE', pattern, handler, opts)

  match(
    method: string,
    pathname: string,
  ): { handler: Handler; params: Record<string, string>; isPublic: boolean } | null {
    const parts = pathname.split('/').filter(Boolean)
    let pathMatched = false

    for (const route of this.routes) {
      if (route.segments.length !== parts.length) continue

      const params: Record<string, string> = {}
      let ok = true
      for (let i = 0; i < route.segments.length; i += 1) {
        const segment = route.segments[i] as string
        const value = parts[i] as string
        if (segment.startsWith(':')) {
          params[segment.slice(1)] = decodeURIComponent(value)
        } else if (segment !== value) {
          ok = false
          break
        }
      }
      if (!ok) continue

      pathMatched = true
      if (route.method === method) {
        return { handler: route.handler, params, isPublic: route.public }
      }
    }

    if (pathMatched) throw new HttpError(405, `Method ${method} not allowed here`)
    return null
  }
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body ?? null)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
  })
  res.end(payload)
}

const MAX_BODY_BYTES = 1_000_000

export async function readJson<T = Record<string, unknown>>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = []
  let size = 0

  for await (const chunk of req) {
    const buf = chunk as Buffer
    size += buf.length
    if (size > MAX_BODY_BYTES) throw badRequest('Request body too large')
    chunks.push(buf)
  }

  if (size === 0) return {} as T

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
  } catch {
    throw badRequest('Body is not valid JSON')
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index === -1) continue
    const name = part.slice(0, index).trim()
    if (!name) continue
    out[name] = decodeURIComponent(part.slice(index + 1).trim())
  }
  return out
}
