-- CreateEnum
CREATE TYPE "SpineInk" AS ENUM ('light', 'dark');

-- AlterTable
ALTER TABLE "book" ADD COLUMN     "spine_ink" "SpineInk";