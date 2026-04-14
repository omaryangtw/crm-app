import { describe, it, expect } from "vitest";
import { getPhotoFilenames } from "./photo-naming";

describe("getPhotoFilenames", () => {
  it("generates correct filenames for JPEG", () => {
    const result = getPhotoFilenames(42, 3, "image/jpeg");
    expect(result.thumbnailFilename).toBe("42-v3-thumb.jpg");
    expect(result.originalFilename).toBe("42-v3-original.jpg");
  });

  it("generates correct filenames for PNG", () => {
    const result = getPhotoFilenames(1, 1, "image/png");
    expect(result.thumbnailFilename).toBe("1-v1-thumb.jpg");
    expect(result.originalFilename).toBe("1-v1-original.png");
  });

  it("generates correct filenames for WebP", () => {
    const result = getPhotoFilenames(100, 5, "image/webp");
    expect(result.thumbnailFilename).toBe("100-v5-thumb.jpg");
    expect(result.originalFilename).toBe("100-v5-original.webp");
  });

  it("thumbnail is always .jpg regardless of MIME type", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
      const { thumbnailFilename } = getPhotoFilenames(1, 1, mime);
      expect(thumbnailFilename).toMatch(/\.jpg$/);
    }
  });

  it("falls back to .jpg for unknown MIME types", () => {
    const result = getPhotoFilenames(1, 1, "image/bmp");
    expect(result.originalFilename).toBe("1-v1-original.jpg");
  });
});
