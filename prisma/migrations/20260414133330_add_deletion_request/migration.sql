-- CreateEnum
CREATE TYPE "DeletionRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'restored');

-- CreateTable
CREATE TABLE "deletion_requests" (
    "id" SERIAL NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "status" "DeletionRequestStatus" NOT NULL DEFAULT 'pending',
    "entity_snapshot" JSONB NOT NULL,
    "cascade_selection" JSONB NOT NULL DEFAULT '[]',
    "requester_id" INTEGER NOT NULL,
    "requester_email" TEXT NOT NULL,
    "reviewer_id" INTEGER,
    "reviewer_email" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "restored_at" TIMESTAMP(3),
    "restored_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deletion_requests_status_idx" ON "deletion_requests"("status");

-- CreateIndex
CREATE INDEX "deletion_requests_requester_id_idx" ON "deletion_requests"("requester_id");

-- CreateIndex (partial unique index for single-pending-request constraint)
CREATE UNIQUE INDEX "deletion_requests_entity_pending_unique" ON "deletion_requests" ("entity_type", "entity_id") WHERE "status" = 'pending';
