import { describe, it, expect } from "vitest";
import {
  validatePhotoFile,
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZE,
} from "./photo-validation";

function makeFile(type: string, size: number): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], "test-file", { type });
}

describe("validatePhotoFile", () => {
  it("accepts a valid JPEG file under 5MB", () => {
    const result = validatePhotoFile(makeFile("image/jpeg", 1024));
    expect(result).toEqual({ valid: true });
  });

  it("accepts a valid PNG file under 5MB", () => {
    const result = validatePhotoFile(makeFile("image/png", 2 * 1024 * 1024));
    expect(result).toEqual({ valid: true });
  });

  it("accepts a valid WebP file under 5MB", () => {
    const result = validatePhotoFile(makeFile("image/webp", 100));
    expect(result).toEqual({ valid: true });
  });

  it("accepts a file exactly at 5MB", () => {
    const result = validatePhotoFile(makeFile("image/jpeg", MAX_FILE_SIZE));
    expect(result).toEqual({ valid: true });
  });

  it("rejects unsupported MIME type", () => {
    const result = validatePhotoFile(makeFile("image/gif", 1024));
    expect(result).toEqual({
      valid: false,
      error: "僅支援 JPEG、PNG、WebP 格式",
    });
  });

  it("rejects file exceeding 5MB", () => {
    const result = validatePhotoFile(
      makeFile("image/jpeg", MAX_FILE_SIZE + 1)
    );
    expect(result).toEqual({
      valid: false,
      error: "檔案大小不可超過 5MB",
    });
  });

  it("checks MIME type before file size (invalid type + oversized)", () => {
    const result = validatePhotoFile(
      makeFile("application/pdf", MAX_FILE_SIZE + 1)
    );
    expect(result).toEqual({
      valid: false,
      error: "僅支援 JPEG、PNG、WebP 格式",
    });
  });

  it("exports correct constants", () => {
    expect(ACCEPTED_MIME_TYPES).toEqual([
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
  });
});
