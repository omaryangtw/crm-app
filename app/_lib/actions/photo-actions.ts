"use server";

import { revalidatePath } from "next/cache";
import path from "path";
import { mkdir, unlink, writeFile } from "fs/promises";
import { prisma } from "../db";
import { auth } from "../auth";
import { ACCEPTED_MIME_TYPES, MAX_FILE_SIZE } from "../utils/photo-validation";
import { getPhotoFilenames, computeNextVersion } from "../utils/photo-naming";
import { createAuditLogEntry } from "../audit/audit-service";

export type UploadPhotoResult =
  | {
      success: true;
      photoId: number;
      photoPath: string;
      originalPhotoPath: string;
      version: number;
    }
  | { success: false; error: string };

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "photos");

export async function uploadPhoto(
  formData: FormData
): Promise<UploadPhotoResult> {
  // 1. Validate session
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  // 2. Extract FormData fields
  const clientIdRaw = formData.get("clientId");
  const thumbnail = formData.get("thumbnail") as File | null;
  const original = formData.get("original") as File | null;

  if (!clientIdRaw || !thumbnail || !original) {
    return { success: false, error: "缺少必要欄位" };
  }

  const clientId = Number(clientIdRaw);
  if (Number.isNaN(clientId) || clientId <= 0) {
    return { success: false, error: "無效的族人 ID" };
  }

  // 3. Validate client exists
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return { success: false, error: "族人不存在" };
  }

  // 4. Validate MIME types
  if (
    !ACCEPTED_MIME_TYPES.includes(
      thumbnail.type as (typeof ACCEPTED_MIME_TYPES)[number]
    )
  ) {
    return { success: false, error: "僅支援 JPEG、PNG、WebP 格式" };
  }
  if (
    !ACCEPTED_MIME_TYPES.includes(
      original.type as (typeof ACCEPTED_MIME_TYPES)[number]
    )
  ) {
    return { success: false, error: "僅支援 JPEG、PNG、WebP 格式" };
  }

  // 5. Validate file size (original ≤ 5MB)
  if (original.size > MAX_FILE_SIZE) {
    return { success: false, error: "檔案大小不可超過 5MB" };
  }

  // 6. Compute next version
  const existingPhotos = await prisma.clientPhoto.findMany({
    where: { clientId },
    select: { version: true },
  });
  const existingVersions = existingPhotos.map((p) => p.version);
  const newVersion = computeNextVersion(existingVersions);

  // 7. Generate filenames
  const { thumbnailFilename, originalFilename } = getPhotoFilenames(
    clientId,
    newVersion,
    original.type
  );

  // 8. Ensure upload directory exists & write files
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });

    const thumbBuffer = Buffer.from(await thumbnail.arrayBuffer());
    const origBuffer = Buffer.from(await original.arrayBuffer());

    await writeFile(path.join(UPLOAD_DIR, thumbnailFilename), thumbBuffer);
    await writeFile(path.join(UPLOAD_DIR, originalFilename), origBuffer);
  } catch {
    return { success: false, error: "照片儲存失敗，請重試" };
  }

  // 9. Create ClientPhoto record
  const photoPath = `/uploads/photos/${thumbnailFilename}`;
  const originalPhotoPath = `/uploads/photos/${originalFilename}`;

  try {
    const record = await prisma.clientPhoto.create({
      data: {
        clientId,
        photoPath,
        originalPhotoPath,
        version: newVersion,
      },
    });

    // 10. Audit log — record photo upload on the Client entity
    try {
      const userId = parseInt(session.user?.id ?? "0", 10);
      const userEmail = session.user?.email ?? "";
      const photoInfo = `v${record.version} (${record.photoPath})`;
      await createAuditLogEntry({
        entityType: "Client",
        entityId: clientId,
        action: "UPDATE",
        userId,
        userEmail,
        oldData: { 照片: null },
        newData: { 照片: photoInfo },
        changedFields: ["照片"],
      });
    } catch {
      // Audit failure must not affect upload result
    }

    // 11. Revalidate client detail page
    revalidatePath(`/clients/${clientId}`);

    return {
      success: true,
      photoId: record.id,
      photoPath: record.photoPath,
      originalPhotoPath: record.originalPhotoPath,
      version: record.version,
    };
  } catch {
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

export async function deletePhoto(
  photoId: number
): Promise<{ success: boolean; error?: string }> {
  // 1. Validate session
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  // 2. Query ClientPhoto record
  const record = await prisma.clientPhoto.findUnique({
    where: { id: photoId },
  });
  if (!record) {
    return { success: false, error: "照片紀錄不存在" };
  }

  // 3. Delete files from filesystem (silently ignore if not found)
  const thumbPath = path.join(process.cwd(), "public", record.photoPath);
  const origPath = path.join(process.cwd(), "public", record.originalPhotoPath);

  await unlink(thumbPath).catch(() => {});
  await unlink(origPath).catch(() => {});

  // 4. Delete ClientPhoto record
  await prisma.clientPhoto.delete({ where: { id: photoId } });

  // 5. Audit log — record photo deletion on the Client entity
  try {
    const userId = parseInt(session.user?.id ?? "0", 10);
    const userEmail = session.user?.email ?? "";
    const photoInfo = `v${record.version} (${record.photoPath})`;
    await createAuditLogEntry({
      entityType: "Client",
      entityId: record.clientId,
      action: "UPDATE",
      userId,
      userEmail,
      oldData: { 照片: photoInfo },
      newData: { 照片: null },
      changedFields: ["照片"],
    });
  } catch {
    // Audit failure must not affect delete result
  }

  // 6. Revalidate client detail page
  revalidatePath(`/clients/${record.clientId}`);

  return { success: true };
}
