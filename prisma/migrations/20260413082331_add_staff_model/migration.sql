-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('male', 'female');

-- CreateEnum
CREATE TYPE "IncomeStatus" AS ENUM ('low', 'mid-low', 'mid-low-elderly');

-- CreateEnum
CREATE TYPE "DisabledStatus" AS ENUM ('light', 'mid', 'heavy');

-- CreateEnum
CREATE TYPE "IndigenousGroup" AS ENUM ('阿美', '泰雅', '布農', '卡那卡那富', '噶瑪蘭', '排灣', '卑南', '魯凱', '拉阿魯哇', '賽夏', '撒奇萊雅', '賽德克', '太魯閣', '邵', '鄒', '雅美');

-- CreateEnum
CREATE TYPE "PlainMountain" AS ENUM ('平原', '山原');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('處理中', '結案');

-- CreateEnum
CREATE TYPE "CaseTypeMajor" AS ENUM ('一般', '法律', '急難救助');

-- CreateEnum
CREATE TYPE "CaseTypeMinor" AS ENUM ('一般', '求職', '陳情', '施政建議', '債務', '勞資', '車禍', '家事', '繼承', '刑事', '諮詢', '非訟', '生活扶助', '死亡救助', '急難紓困', '重大災害', '醫療補助');

-- CreateEnum
CREATE TYPE "ContactType" AS ENUM ('撥出', '來電', '親訪', '簡訊');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'user');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "name_alt" TEXT,
    "idn" TEXT,
    "sex" "Sex",
    "birthday" DATE,
    "is_dead" BOOLEAN NOT NULL DEFAULT false,
    "household_admin" BOOLEAN NOT NULL DEFAULT false,
    "income_status" "IncomeStatus",
    "disabled_status" "DisabledStatus",
    "indigenous_group" "IndigenousGroup",
    "tribe" TEXT,
    "plain_mountain" "PlainMountain",
    "can_call" BOOLEAN NOT NULL DEFAULT true,
    "phone" TEXT,
    "phone_note" TEXT,
    "phone_alt" TEXT,
    "phone_alt_note" TEXT,
    "mobile" TEXT,
    "mobile_note" TEXT,
    "mobile_alt" TEXT,
    "mobile_alt_note" TEXT,
    "can_mail" BOOLEAN NOT NULL DEFAULT true,
    "city" TEXT,
    "city_alt" TEXT,
    "dist" TEXT,
    "dist_alt" TEXT,
    "vill" TEXT,
    "vill_alt" TEXT,
    "addr" TEXT,
    "addr_alt" TEXT,
    "addr_note" TEXT,
    "addr_alt_note" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "status" "CaseStatus",
    "person_in_charge" TEXT,
    "person_in_charge_id" INTEGER,
    "types_major" "CaseTypeMajor",
    "types_minor" "CaseTypeMinor",
    "relation1" TEXT,
    "relation2" TEXT,
    "relation3" TEXT,
    "contact1" TEXT,
    "contact2" TEXT,
    "contact3" TEXT,
    "note" TEXT,
    "handle" TEXT,
    "client_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" SERIAL NOT NULL,
    "date" DATE,
    "contact_type" "ContactType",
    "is_success" BOOLEAN NOT NULL DEFAULT true,
    "record" TEXT,
    "person_in_charge" TEXT,
    "person_in_charge_id" INTEGER,
    "client_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "todos" (
    "id" SERIAL NOT NULL,
    "date" DATE,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "client_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "todos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_relations" (
    "id" SERIAL NOT NULL,
    "person_a_id" INTEGER NOT NULL,
    "person_b_id" INTEGER NOT NULL,
    "relation_a_to_b" TEXT NOT NULL,
    "relation_b_to_a" TEXT NOT NULL,

    CONSTRAINT "family_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "family_relations_person_a_id_person_b_id_key" ON "family_relations"("person_a_id", "person_b_id");

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_person_in_charge_id_fkey" FOREIGN KEY ("person_in_charge_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_person_in_charge_id_fkey" FOREIGN KEY ("person_in_charge_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "todos" ADD CONSTRAINT "todos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_relations" ADD CONSTRAINT "family_relations_person_a_id_fkey" FOREIGN KEY ("person_a_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_relations" ADD CONSTRAINT "family_relations_person_b_id_fkey" FOREIGN KEY ("person_b_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
