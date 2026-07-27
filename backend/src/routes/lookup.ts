import { Readable } from 'node:stream'
import { prisma } from '../db.ts'
import { config } from '../config.ts'
import { badRequest, HANDLED, notFound, type Ctx, type Router } from '../http.ts'
import { isValidIsbn, normalizeIsbn, toIsbn13 } from '../isbn.ts'
import { lookupIsbn } from '../lookup.ts'
import { searchByTitle } from '../providers/titlesearch.ts'
import type { LookupResult } from '../types.ts'

const COVER_HOSTS = new Set([
  'covers.openlibrary.org',
  'books.google.com',
  'books.googleusercontent.com',
  'lh3.googleusercontent.com',
  'lh4.googleusercontent.com',
  'lh5.googleusercontent.com',
  'lh6.googleusercontent.com',
])

export function registerLookupRoutes(router: Router): void {
  router.get('/api/lookup/isbn/:isbn', async ({ params }: Ctx): Promise<LookupResult> => {
    const isbn = normalizeIsbn(params.isbn)
    if (!isbn) throw badRequest('Enter an ISBN to search for')
    if (!isValidIsbn(isbn)) {
      throw badRequest('That is not a valid ISBN — check the digits, or search by title instead')
    }

    const isbn13 = toIsbn13(isbn)
    const existing = isbn13
      ? await prisma.book.findUnique({ where: { isbn13 }, select: { id: true } })
      : null

    const { book, sources } = await lookupIsbn(isbn)
    return { found: book !== null, sources, book, existingBookId: existing?.id ?? null }
  })

  router.get('/api/lookup/title', async ({ query: q }: Ctx) => {
    const term = q.get('q')?.trim() ?? ''
    if (term.length < 2) throw badRequest('Type at least two letters of the title')

    const { results, sources } = await searchByTitle(term)

    const isbns = results.map((entry) => entry.isbn13).filter((isbn) => isbn !== null)
    const owned = await prisma.book.findMany({
      where: { isbn13: { in: isbns } },
      select: { id: true, isbn13: true },
    })
    const ownedByIsbn = new Map(owned.map((book) => [book.isbn13, book.id]))

    const withOwnership = results.map((entry) => ({
      ...entry,
      existingBookId: (entry.isbn13 && ownedByIsbn.get(entry.isbn13)) ?? null,
    }))

    return { term, sources, results: withOwnership }
  })

  router.get('/api/cover-proxy', async ({ query: q, res }: Ctx) => {
    const raw = q.get('url')
    if (!raw) throw badRequest('No cover URL given')

    let target: URL
    try {
      target = new URL(raw)
    } catch {
      throw badRequest('That is not a URL')
    }

    if (target.protocol !== 'https:' || !COVER_HOSTS.has(target.hostname)) {
      throw badRequest('Covers can only be fetched from the known catalogue hosts')
    }

    const upstream = await fetch(target, {
      headers: { accept: 'image/*' },
      signal: AbortSignal.timeout(config.lookupTimeoutMs),
    }).catch(() => null)

    if (!upstream?.ok || !upstream.body) throw notFound('That cover could not be fetched')

    const type = upstream.headers.get('content-type') ?? 'image/jpeg'
    if (!type.startsWith('image/')) throw badRequest('That URL is not an image')

    res.writeHead(200, {
      'content-type': type,
      'cache-control': 'public, max-age=86400',
      'cross-origin-resource-policy': 'same-origin',
    })

    await new Promise<void>((resolve, reject) => {
      Readable.fromWeb(upstream.body as never)
        .on('error', reject)
        .on('end', resolve)
        .pipe(res)
    })

    return HANDLED
  })
}
