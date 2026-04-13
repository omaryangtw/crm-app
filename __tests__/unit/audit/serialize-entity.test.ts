import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { serializeEntity } from "@/app/_lib/audit/audit-service";

/**
 * **Validates: Requirements 7.1, 7.2, 7.3**
 *
 * Property 2: Entity serialization round-trip
 * For any valid entity record containing strings, numbers, booleans, nulls,
 * Date objects, and string arrays, calling serializeEntity(record) shall produce
 * an equivalent object where:
 * - String, number, boolean, and null fields are identical.
 * - Date fields are converted to their ISO 8601 string representation.
 * - Array fields preserve order and element values.
 */
describe("Feature: audit-log, Property 2: Entity serialization round-trip", () => {
  /** Arbitrary for valid Date objects within a reasonable range. */
  const arbDate = fc
    .date({
      min: new Date("2000-01-01T00:00:00.000Z"),
      max: new Date("2099-12-31T23:59:59.999Z"),
    })
    .filter((d) => !isNaN(d.getTime()));

  /**
   * Arbitrary that produces entity-field values: strings, numbers, booleans,
   * nulls, Dates, string arrays.
   * Excludes -0 because JSON.stringify(-0) === "0" — this is standard JSON
   * behaviour, not a serialization bug.
   */
  const safeDouble = fc
    .double({ noNaN: true, noDefaultInfinity: true })
    .filter((n) => !Object.is(n, -0));

  const entityFieldValue = fc.oneof(
    fc.string(),
    fc.integer(),
    safeDouble,
    fc.boolean(),
    fc.constant(null),
    arbDate,
    fc.array(fc.string(), { maxLength: 5 })
  );

  /** Arbitrary that produces entity-shaped plain objects. */
  const entityRecord = fc.dictionary(
    fc.string({ minLength: 1, maxLength: 8 }),
    entityFieldValue,
    { maxKeys: 10 }
  );

  /**
   * Normalize a single field value the way serializeEntity is expected to:
   * - Date → ISO string
   * - Everything else unchanged
   */
  function expectedValue(val: unknown): unknown {
    if (val instanceof Date) {
      return val.toISOString();
    }
    return val;
  }

  it("primitive fields (string, number, boolean, null) are identical after round-trip", () => {
    fc.assert(
      fc.property(entityRecord, (record) => {
        const serialized = serializeEntity(record);
        for (const [key, val] of Object.entries(record)) {
          if (
            typeof val === "string" ||
            typeof val === "number" ||
            typeof val === "boolean" ||
            val === null
          ) {
            expect(serialized[key]).toBe(val);
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it("Date fields are converted to their ISO 8601 string representation", () => {
    fc.assert(
      fc.property(entityRecord, (record) => {
        const serialized = serializeEntity(record);
        for (const [key, val] of Object.entries(record)) {
          if (val instanceof Date) {
            expect(serialized[key]).toBe(val.toISOString());
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it("array fields preserve order and element values", () => {
    fc.assert(
      fc.property(entityRecord, (record) => {
        const serialized = serializeEntity(record);
        for (const [key, val] of Object.entries(record)) {
          if (Array.isArray(val)) {
            expect(serialized[key]).toEqual(val);
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it("full round-trip equivalence with Date→ISO normalization", () => {
    fc.assert(
      fc.property(entityRecord, (record) => {
        const serialized = serializeEntity(record);

        // Same set of keys
        expect(Object.keys(serialized).sort()).toEqual(
          Object.keys(record).sort()
        );

        // Each field matches the expected normalized value
        for (const [key, val] of Object.entries(record)) {
          expect(serialized[key]).toEqual(expectedValue(val));
        }
      }),
      { numRuns: 200 }
    );
  });
});
