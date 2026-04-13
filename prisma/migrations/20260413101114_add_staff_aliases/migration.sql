-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
