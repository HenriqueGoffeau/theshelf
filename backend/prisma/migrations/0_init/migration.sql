-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ReadingStatus" AS ENUM ('unread', 'reading', 'finished', 'aside');

-- CreateEnum
CREATE TYPE "BookLocation" AS ENUM ('owned', 'wishlist');

-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('note', 'review', 'started', 'finished');

-- CreateEnum
CREATE TYPE "ShelfKind" AS ENUM ('manual', 'smart');

-- CreateTable
CREATE TABLE "author" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nationality" TEXT,
    "openlibrary_key" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "author_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "genre" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book" (
    "id" SERIAL NOT NULL,
    "isbn13" TEXT,
    "isbn10" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "publisher" TEXT,
    "published_year" INTEGER,
    "page_count" INTEGER,
    "language" TEXT,
    "description" TEXT,
    "cover_url" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "location" "BookLocation" NOT NULL DEFAULT 'owned',
    "reading_status" "ReadingStatus" NOT NULL DEFAULT 'unread',
    "rating" SMALLINT,
    "wish_reason" TEXT,
    "spine_color" TEXT,
    "spine_width" INTEGER,
    "spine_height" INTEGER,
    "acquired_on" DATE,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_author" (
    "book_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "book_author_pkey" PRIMARY KEY ("book_id","author_id")
);

-- CreateTable
CREATE TABLE "book_genre" (
    "book_id" INTEGER NOT NULL,
    "genre_id" INTEGER NOT NULL,

    CONSTRAINT "book_genre_pkey" PRIMARY KEY ("book_id","genre_id")
);

-- CreateTable
CREATE TABLE "shelf" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "kind" "ShelfKind" NOT NULL DEFAULT 'manual',
    "query" JSONB,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shelf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelf_book" (
    "shelf_id" INTEGER NOT NULL,
    "book_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shelf_book_pkey" PRIMARY KEY ("shelf_id","book_id")
);

-- CreateTable
CREATE TABLE "note" (
    "id" SERIAL NOT NULL,
    "book_id" INTEGER NOT NULL,
    "page" INTEGER,
    "kind" "NoteKind" NOT NULL DEFAULT 'note',
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "author_name_unique" ON "author"("name");

-- CreateIndex
CREATE UNIQUE INDEX "genre_name_unique" ON "genre"("name");

-- CreateIndex
CREATE UNIQUE INDEX "book_isbn13_unique" ON "book"("isbn13");

-- CreateIndex
CREATE INDEX "book_location_idx" ON "book"("location");

-- CreateIndex
CREATE INDEX "book_title_idx" ON "book"("title");

-- CreateIndex
CREATE INDEX "book_author_author_idx" ON "book_author"("author_id");

-- CreateIndex
CREATE INDEX "book_genre_genre_idx" ON "book_genre"("genre_id");

-- CreateIndex
CREATE UNIQUE INDEX "shelf_name_unique" ON "shelf"("name");

-- CreateIndex
CREATE INDEX "shelf_book_book_idx" ON "shelf_book"("book_id");

-- CreateIndex
CREATE INDEX "note_book_idx" ON "note"("book_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "note_created_idx" ON "note"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "book_author" ADD CONSTRAINT "book_author_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_author" ADD CONSTRAINT "book_author_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "author"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_genre" ADD CONSTRAINT "book_genre_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "book_genre" ADD CONSTRAINT "book_genre_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelf_book" ADD CONSTRAINT "shelf_book_shelf_id_fkey" FOREIGN KEY ("shelf_id") REFERENCES "shelf"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelf_book" ADD CONSTRAINT "shelf_book_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "note" ADD CONSTRAINT "note_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraint
ALTER TABLE "book" ADD CONSTRAINT "book_rating_check" CHECK ("rating" BETWEEN 1 AND 5);
