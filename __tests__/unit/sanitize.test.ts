// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { sanitizeText, sanitizeObject } from "@/app/_lib/utils/sanitize";

/**
 * **Validates: Requirements 29.4**
 *
 * Property 18: Input sanitization
 * Strings containing HTML tags like <script>, <img onerror=...>, and SQL
 * injection patterns are neutralized. Clean alphanumeric strings pass
 * through unchanged. sanitizeObject sanitizes all string values in an object.
 */
describe("Feature: crm-modernization, Property 18: Input sanitization", () => {
  it("neutralizes <script> tags from any string", () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.string(), fc.string()).map(
          ([prefix, suffix]) =>
            `${prefix}<script>alert(1)</script>${suffix}`
        ),
        (input) => {
          const result = sanitizeText(input);
          expect(result.toLowerCase()).not.toContain("<script>");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("neutralizes <img onerror=...> tags from any string", () => {
    fc.assert(
      fc.property(
        fc.tuple(fc.string(), fc.string()).map(
          ([prefix, suffix]) =>
            `${prefix}<img onerror="alert(1)" src="x">${suffix}`
        ),
        (input) => {
          const result = sanitizeText(input);
          expect(result.toLowerCase()).not.toContain("<img");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("passes clean alphanumeric strings through unchanged", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-zA-Z0-9 ]*$/),
        (input) => {
          const result = sanitizeText(input);
          expect(result).toBe(input);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("sanitizeObject sanitizes all string values in an object", () => {
    fc.assert(
      fc.property(
        fc.record({
          a: fc.string(),
          b: fc.string(),
          c: fc.constant(42),
        }),
        (obj) => {
          const malicious = {
            a: `<script>${obj.a}</script>`,
            b: `<img onerror="x">${obj.b}`,
            c: obj.c,
          };
          const result = sanitizeObject(malicious);
          // All string values should be sanitized
          expect((result.a as string).toLowerCase()).not.toContain("<script>");
          expect((result.b as string).toLowerCase()).not.toContain("<img");
          // Non-string values should be unchanged
          expect(result.c).toBe(42);
        }
      ),
      { numRuns: 100 }
    );
  });
});
