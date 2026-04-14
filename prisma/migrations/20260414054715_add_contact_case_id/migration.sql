-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "case_id" INTEGER;

-- CreateIndex
CREATE INDEX "contacts_case_id_idx" ON "contacts"("case_id");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
