-- AlterTable
ALTER TABLE "cases" ALTER COLUMN "client_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "contacts" ALTER COLUMN "client_id" DROP NOT NULL;
