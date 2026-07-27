import { PrismaPg } from '@prisma/adapter-pg'
import { config } from './config.ts'
import { PrismaClient } from './generated/prisma/client.ts'

const adapter = new PrismaPg(
  {
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
  },
  {
    onPoolError: (err) => console.error('[db] pool error', err),
    onConnectionError: (err) => console.error('[db] connection error', err),
  },
)

export const prisma = new PrismaClient({ adapter })

export async function waitForDatabase(attempts = 30, delayMs = 1000): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.$queryRaw`select 1`
      return
    } catch (err) {
      if (attempt === attempts) throw err
      console.log(`[db] not ready yet (attempt ${attempt}/${attempts}), retrying...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

const SMART_SHELVES = [
  { name: 'Currently open', note: 'in progress', readingStatus: 'reading', position: 0 },
  { name: 'Finished', note: 'read to the end', readingStatus: 'finished', position: 1 },
  { name: 'Set aside', note: 'put down for now', readingStatus: 'aside', position: 2 },
  { name: 'Unread', note: 'waiting their turn', readingStatus: 'unread', position: 3 },
] as const

export async function ensureSmartShelves(): Promise<void> {
  for (const shelf of SMART_SHELVES) {
    await prisma.shelf.upsert({
      where: { name: shelf.name },
      update: {},
      create: {
        name: shelf.name,
        note: shelf.note,
        kind: 'smart',
        position: shelf.position,
        query: { readingStatus: shelf.readingStatus },
      },
    })
  }
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect()
}
