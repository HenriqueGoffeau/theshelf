import type { Prisma } from './generated/prisma/client.ts'

export type Tx = Prisma.TransactionClient

export async function setBookAuthors(tx: Tx, bookId: number, names: string[]): Promise<void> {
  const ids: number[] = []

  for (const name of names) {
    const existing = await tx.author.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    })
    ids.push(existing ? existing.id : (await tx.author.create({ data: { name }, select: { id: true } })).id)
  }

  await tx.bookAuthor.deleteMany({ where: { bookId } })
  await tx.bookAuthor.createMany({
    data: ids.map((authorId, position) => ({ bookId, authorId, position })),
    skipDuplicates: true,
  })
}

export async function setBookGenres(tx: Tx, bookId: number, names: string[]): Promise<void> {
  const ids: number[] = []

  for (const name of names) {
    const existing = await tx.genre.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    })
    ids.push(existing ? existing.id : (await tx.genre.create({ data: { name }, select: { id: true } })).id)
  }

  await tx.bookGenre.deleteMany({ where: { bookId } })
  await tx.bookGenre.createMany({
    data: ids.map((genreId) => ({ bookId, genreId })),
    skipDuplicates: true,
  })
}

export async function pruneOrphans(tx: Tx): Promise<void> {
  await tx.author.deleteMany({ where: { nationality: null, books: { none: {} } } })
  await tx.genre.deleteMany({ where: { books: { none: {} } } })
}
