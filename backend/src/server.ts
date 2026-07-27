import { createServer } from 'node:http'
import { requireAuth } from './auth.ts'
import { config } from './config.ts'
import { disconnect, ensureSmartShelves, waitForDatabase } from './db.ts'
import { HANDLED, HttpError, HttpResponse, Router, notFound, sendJson } from './http.ts'
import { registerAuthRoutes } from './routes/auth.ts'
import { registerAuthorRoutes } from './routes/authors.ts'
import { registerBookRoutes } from './routes/books.ts'
import { registerGenreRoutes } from './routes/genres.ts'
import { registerLibraryRoutes } from './routes/library.ts'
import { registerLookupRoutes } from './routes/lookup.ts'
import { registerNoteRoutes } from './routes/notes.ts'
import { registerSearchRoutes } from './routes/search.ts'
import { registerShelfRoutes } from './routes/shelves.ts'

const router = new Router()
registerAuthRoutes(router)
registerBookRoutes(router)
registerShelfRoutes(router)
registerNoteRoutes(router)
registerSearchRoutes(router)
registerAuthorRoutes(router)
registerGenreRoutes(router)
registerLibraryRoutes(router)
registerLookupRoutes(router)

const server = createServer(async (req, res) => {
  const startedAt = performance.now()
  const method = req.method ?? 'GET'
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

  if (config.corsOrigin) {
    res.setHeader('access-control-allow-origin', config.corsOrigin)
    res.setHeader('access-control-allow-credentials', 'true')
    res.setHeader('access-control-allow-headers', 'content-type')
    res.setHeader('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
    if (method === 'OPTIONS') {
      res.writeHead(204).end()
      return
    }
  }

  let status = 200
  try {
    const matched = router.match(method, url.pathname)
    if (!matched) throw notFound(`No route for ${method} ${url.pathname}`)
    if (!matched.isPublic) requireAuth({ req })

    const result = await matched.handler({
      req,
      res,
      params: matched.params,
      query: url.searchParams,
    })

    if (result === HANDLED) {
      status = res.statusCode
    } else if (result instanceof HttpResponse) {
      status = result.status
      sendJson(res, result.status, result.body)
    } else {
      sendJson(res, 200, result)
    }
  } catch (err) {
    if (res.headersSent) {
      status = res.statusCode
      res.end()
    } else if (err instanceof HttpError) {
      status = err.status
      sendJson(res, err.status, { error: err.message, details: err.details ?? null })
    } else {
      status = 500
      console.error(`[error] ${method} ${url.pathname}`, err)
      sendJson(res, 500, { error: 'Something went wrong on the shelf' })
    }
  } finally {
    const ms = (performance.now() - startedAt).toFixed(0)
    console.log(`${method} ${url.pathname}${url.search} -> ${status} (${ms}ms)`)
  }
})

async function start(): Promise<void> {
  await waitForDatabase()
  await ensureSmartShelves()

  server.listen(config.port, () => {
    console.log(`[server] the shelf is listening on http://localhost:${config.port}`)
  })
}

async function shutdown(signal: string): Promise<void> {
  console.log(`[server] ${signal} received, closing up`)
  server.close()
  await disconnect().catch(() => {})
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))

start().catch((err) => {
  console.error('[server] failed to start', err)
  process.exit(1)
})
