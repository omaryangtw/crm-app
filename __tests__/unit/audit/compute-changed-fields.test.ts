import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeChangedFields } from "@/app/_lib/audit/audit-service";

/**
 * **Validates: Requirements 3.1, 3.3**
 *
 * Property 1: Changed-fields diff correctness (bidirectional)
 * For any two plain objects oldData and newData, computeChangedFields(oldData, newData)
 * shall have no false positives (every returned field truly differs) and no false
 * negatives (every omitted field truly matches).
 */
describe("Feature: audit-log, Property 1: Changed-fields diff correctness (bidirectional)", () => {
  /** Arbitrary that produces JSON-safe values suitable for Record<string, unknown> fields. */
  const jsonValue = fc.oneof(
    fc.string(),
    fc.integer(),
    fc.double({ noNaN: true, noDefaultInfinity: true }),
    fc.boolean(),
    fc.constant(null),
    fc.array(fc.string(), { maxLength: 5 }),
    fc.dictionary(fc.string({ maxLength: 4 }), fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)), { maxKeys: 3 })
  );

  const plainObject = fc.dictionary(
    fc.string({ minLength: 1, maxLength: 8 }),
    jsonValue,
    { maxKeys: 10 }
  );

  it("no false positives: every field in the result truly differs between oldData and newData", () => {
    fc.assert(
      fc.property(plainObject, plainObject, (oldData, newData) => {
        const changed = computeChangedFields(oldData, newData);
        for (const field of changed) {
          expect(JSON.stringify(oldData[field])).not.toBe(
            JSON.stringify(newData[field])
          );
        }
      }),
      { numRuns: 200 }
    );
  });

  it("no false negatives: every field NOT in the result has equal serialized values", () => {
    fc.assert(
      fc.property(plainObject, plainObject, (oldData, newData) => {
        const changed = computeChangedFields(oldData, newData);
        const changedSet = new Set(changed);
        const allKeys = new Set([
          ...Object.keys(oldData),
          ...Object.keys(newData),
        ]);
        for (const field of allKeys) {
          if (!changedSet.has(field)) {
            expect(JSON.stringify(oldData[field])).toBe(
              JSON.stringify(newData[field])
            );
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it("identical objects produce an empty changed-fields list", () => {
    fc.assert(
      fc.property(plainObject, (data) => {
        const copy = JSON.parse(JSON.stringify(data));
        const changed = computeChangedFields(data, copy);
        expect(changed).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });
});
