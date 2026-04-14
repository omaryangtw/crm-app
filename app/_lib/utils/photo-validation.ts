export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

type ValidationResult = { valid: true } | { valid: false; error: string };

export function validatePhotoFile(file: File): ValidationResult {
  if (!ACCEPTED_MIME_TYPES.includes(file.type as (typeof ACCEPTED_MIME_TYPES)[number])) {
    return { valid: false, error: "僅支援 JPEG、PNG、WebP 格式" };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "檔案大小不可超過 5MB" };
  }

  return { valid: true };
}
