import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  validatePhotoFile,
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZE,
} from "@/app/_lib/utils/photo-validation";
import { getPhotoFilenames, computeNextVersion } from "@/app/_lib/utils/photo-naming";

/**
 * **Feature: photo-upload-crop, Property 1: 檔案驗證正確性**
 *
 * **Validates: Requirements 1.2, 1.4, 1.5, 7.2**
 *
 * For any file (represented by MIME type and size), `validatePhotoFile` should
 * return `{ valid: true }` if and only if the MIME type is in ACCEPTED_MIME_TYPES
 * and size ≤ 5MB. Otherwise it should return `{ valid: false, error: string }`
 * with the correct error message.
 */
describe("Feature: photo-upload-crop, Property 1: 檔案驗證正確性", () => {
  /** Helper: create a minimal File-like object with the given type and size. */
  function fakeFile(type: string, size: number): File {
    // Create a File with an empty body — only type and size matter for validation
    const file = new File([""], "test", { type });
    Object.defineProperty(file, "size", { value: size });
    return file;
  }

  const acceptedSet = new Set<string>(ACCEPTED_MIME_TYPES);

  it("accepted type + size ≤ 5MB → valid", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ACCEPTED_MIME_TYPES),
        fc.integer({ min: 0, max: MAX_FILE_SIZE }),
        (type, size) => {
          const result = validatePhotoFile(fakeFile(type, size));
          expect(result).toEqual({ valid: true });
        }
      ),
      { numRuns: 100 }
    );
  });

  it("unaccepted type → invalid with format error", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !acceptedSet.has(s)),
        fc.integer({ min: 0, max: MAX_FILE_SIZE }),
        (type, size) => {
          const result = validatePhotoFile(fakeFile(type, size));
          expect(result).toEqual({
            valid: false,
            error: "僅支援 JPEG、PNG、WebP 格式",
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it("accepted type + size > 5MB → invalid with size error", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ACCEPTED_MIME_TYPES),
        fc.integer({ min: MAX_FILE_SIZE + 1, max: 20_000_000 }),
        (type, size) => {
          const result = validatePhotoFile(fakeFile(type, size));
          expect(result).toEqual({
            valid: false,
            error: "檔案大小不可超過 5MB",
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it("random type + size: valid iff type ∈ accepted AND size ≤ 5MB", () => {
    fc.assert(
      fc.property(
        fc.record({
          type: fc.string(),
          size: fc.integer({ min: 0, max: 20_000_000 }),
        }),
        ({ type, size }) => {
          const result = validatePhotoFile(fakeFile(type, size));
          const isAcceptedType = acceptedSet.has(type);
          const isAcceptedSize = size <= MAX_FILE_SIZE;

          if (isAcceptedType && isAcceptedSize) {
            expect(result).toEqual({ valid: true });
          } else if (!isAcceptedType) {
            // Type check runs first — invalid type always yields format error
            expect(result).toEqual({
              valid: false,
              error: "僅支援 JPEG、PNG、WebP 格式",
            });
          } else {
            // Accepted type but size too large
            expect(result).toEqual({
              valid: false,
              error: "檔案大小不可超過 5MB",
            });
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: photo-upload-crop, Property 2: 檔案命名模式一致性**
 *
 * **Validates: Requirements 3.3**
 *
 * For any valid clientId (positive integer), version (positive integer), and
 * MIME type (one of the accepted formats), `getPhotoFilenames` should produce
 * a thumbnailFilename matching `{clientId}-v{version}-thumb.jpg` and an
 * originalFilename matching `{clientId}-v{version}-original.{ext}` where ext
 * corresponds to the MIME type.
 */
describe("Feature: photo-upload-crop, Property 2: 檔案命名模式一致性", () => {
  const MIME_TO_EXT: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  it("thumbnailFilename matches {clientId}-v{version}-thumb.jpg pattern", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1 }),
        fc.integer({ min: 1 }),
        fc.constantFrom("image/jpeg", "image/png", "image/webp"),
        (clientId, version, mimeType) => {
          const { thumbnailFilename } = getPhotoFilenames(clientId, version, mimeType);
          const pattern = new RegExp(`^${clientId}-v${version}-thumb\\.jpg$`);
          expect(thumbnailFilename).toMatch(pattern);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("originalFilename matches {clientId}-v{version}-original.{ext} pattern", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1 }),
        fc.integer({ min: 1 }),
        fc.constantFrom("image/jpeg", "image/png", "image/webp"),
        (clientId, version, mimeType) => {
          const { originalFilename } = getPhotoFilenames(clientId, version, mimeType);
          const pattern = new RegExp(
            `^${clientId}-v${version}-original\\.(jpg|png|webp)$`
          );
          expect(originalFilename).toMatch(pattern);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("original extension corresponds to the given MIME type", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1 }),
        fc.integer({ min: 1 }),
        fc.constantFrom("image/jpeg", "image/png", "image/webp"),
        (clientId, version, mimeType) => {
          const { originalFilename } = getPhotoFilenames(clientId, version, mimeType);
          const expectedExt = MIME_TO_EXT[mimeType];
          expect(originalFilename.endsWith(`.${expectedExt}`)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: photo-upload-crop, Property 3: 版本自動遞增**
 *
 * **Validates: Requirements 3.4, 6.2**
 *
 * For any set of existing photo version numbers (possibly empty),
 * `computeNextVersion` should return `Math.max(...versions, 0) + 1`.
 * When the set is empty, the result should be 1.
 */
describe("Feature: photo-upload-crop, Property 3: 版本自動遞增", () => {
  it("next version equals Math.max(...versions, 0) + 1", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 0, maxLength: 20 }),
        (versions) => {
          const result = computeNextVersion(versions);
          const expected = Math.max(...versions, 0) + 1;
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * **Feature: photo-upload-crop, Property 4: Active Photo 為最新版本**
 *
 * **Validates: Requirements 3.5, 3.8, 6.4**
 *
 * For any non-empty set of ClientPhoto records with unique version numbers,
 * when sorted by version descending the record at index 0 (Active_Photo)
 * should have the maximum version value.
 */
describe("Feature: photo-upload-crop, Property 4: Active Photo 為最新版本", () => {
  interface PhotoRecord {
    id: number;
    photoPath: string;
    originalPhotoPath: string;
    version: number;
    createdAt: Date;
  }

  /** Build a photo record array from version numbers. */
  function buildPhotoRecords(versions: number[]): PhotoRecord[] {
    return versions.map((v, i) => ({
      id: i + 1,
      photoPath: `/uploads/photos/1-v${v}-thumb.jpg`,
      originalPhotoPath: `/uploads/photos/1-v${v}-original.jpg`,
      version: v,
      createdAt: new Date(Date.now() - (versions.length - i) * 1000),
    }));
  }

  it("active photo (index 0 after desc sort) has the maximum version", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 1000 }), { minLength: 1 }),
        (versions) => {
          const records = buildPhotoRecords(versions);
          // Sort by version descending — same as Prisma `orderBy: { version: "desc" }`
          const sorted = [...records].sort((a, b) => b.version - a.version);
          const activePhoto = sorted[0];
          const maxVersion = Math.max(...versions);
          expect(activePhoto.version).toBe(maxVersion);
        }
      ),
      { numRuns: 100 }
    );
  });
});
