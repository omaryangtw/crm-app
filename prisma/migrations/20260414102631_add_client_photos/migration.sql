-- CreateTable
CREATE TABLE "client_photos" (
    "id" SERIAL NOT NULL,
    "client_id" INTEGER NOT NULL,
    "photo_path" TEXT NOT NULL,
    "original_photo_path" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_photos_client_id_idx" ON "client_photos"("client_id");

-- AddForeignKey
ALTER TABLE "client_photos" ADD CONSTRAINT "client_photos_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
