/**
 * Property 16: CSV serialization round-trip
 *
 * Tests that serialize → parse produces equivalent field values (as strings).
 * Uses Papa Parse for both directions.
 *
 * **Validates: Requirements 20.5**
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import Papa from "papaparse";
import { generateCsv } from "@/app/_lib/utils/export-utils";

// Generate safe CSV cell values: no newlines, no quotes that break CSV
const safeCsvValue = fc
  .string({ minLength: 0, maxLength: 50 })
  .map((s) => s.replace(/[\r\n"]/g, "").trim());

describe("Property 16: CSV serialization round-trip", () => {
  it("field values survive CSV serialize → parse round-trip as strings", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: safeCsvValue,
            city: safeCsvValue,
            mobile: safeCsvValue,
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (records) => {
          const columns = ["name", "city", "mobile"];
          const csv = generateCsv(records, columns);

          const parsed = Papa.parse<Record<string, string>>(csv, {
            header: true,
            skipEmptyLines: true,
          });

          expect(parsed.data.length).toBe(records.length);

          for (let i = 0; i < records.length; i++) {
            for (const col of columns) {
              const original = String((records[i] as Record<string, unknown>)[col] ?? "");
              const roundTripped = parsed.data[i][col] ?? "";
              expect(roundTripped).toBe(original);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("null values round-trip as empty strings", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.constantFrom("Alice", "Bob", "Charlie"),
            city: fc.constant(null),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (records) => {
          const columns = ["name", "city"];
          const typedRecords = records as unknown as Record<string, unknown>[];
          const csv = generateCsv(typedRecords, columns);

          const parsed = Papa.parse<Record<string, string>>(csv, {
            header: true,
            skipEmptyLines: true,
          });

          expect(parsed.data.length).toBe(records.length);

          for (let i = 0; i < records.length; i++) {
            // null becomes empty string in CSV
            expect(parsed.data[i].city).toBe("");
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("single-column CSV round-trips correctly", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ name: safeCsvValue.filter((s) => s.length > 0) }),
          { minLength: 1, maxLength: 10 }
        ),
        (records) => {
          const csv = generateCsv(records, ["name"]);
          const parsed = Papa.parse<Record<string, string>>(csv, {
            header: true,
            skipEmptyLines: true,
          });

          expect(parsed.data.length).toBe(records.length);
          for (let i = 0; i < records.length; i++) {
            expect(parsed.data[i].name).toBe(String(records[i].name ?? ""));
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
