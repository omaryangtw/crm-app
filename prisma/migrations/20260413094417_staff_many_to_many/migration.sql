/*
  Warnings:

  - You are about to drop the column `person_in_charge` on the `cases` table. All the data in the column will be lost.
  - You are about to drop the column `person_in_charge_id` on the `cases` table. All the data in the column will be lost.
  - You are about to drop the column `person_in_charge` on the `contacts` table. All the data in the column will be lost.
  - You are about to drop the column `person_in_charge_id` on the `contacts` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "cases" DROP CONSTRAINT "cases_person_in_charge_id_fkey";

-- DropForeignKey
ALTER TABLE "contacts" DROP CONSTRAINT "contacts_person_in_charge_id_fkey";

-- AlterTable
ALTER TABLE "cases" DROP COLUMN "person_in_charge",
DROP COLUMN "person_in_charge_id",
ADD COLUMN     "person_in_charge_legacy" TEXT;

-- AlterTable
ALTER TABLE "contacts" DROP COLUMN "person_in_charge",
DROP COLUMN "person_in_charge_id",
ADD COLUMN     "person_in_charge_legacy" TEXT;

-- CreateTable
CREATE TABLE "_CaseToStaff" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_CaseToStaff_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ContactToStaff" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ContactToStaff_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_CaseToStaff_B_index" ON "_CaseToStaff"("B");

-- CreateIndex
CREATE INDEX "_ContactToStaff_B_index" ON "_ContactToStaff"("B");

-- AddForeignKey
ALTER TABLE "_CaseToStaff" ADD CONSTRAINT "_CaseToStaff_A_fkey" FOREIGN KEY ("A") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CaseToStaff" ADD CONSTRAINT "_CaseToStaff_B_fkey" FOREIGN KEY ("B") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContactToStaff" ADD CONSTRAINT "_ContactToStaff_A_fkey" FOREIGN KEY ("A") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ContactToStaff" ADD CONSTRAINT "_ContactToStaff_B_fkey" FOREIGN KEY ("B") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
