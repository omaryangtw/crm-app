/**
 * Property 15: Export filter and projection
 *
 * Tests that buildExportWhereClause produces correct Prisma WHERE clauses
 * and that projectColumns selects only specified columns.
 *
 * **Validates: Requirements 20.1, 20.3**
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  buildExportWhereClause,
  projectColumns,
} from "@/app/_lib/utils/export-utils";
import type { ExportQuery } from "@/app/_lib/schemas/export-schema";

// Helper: check if a Prisma WHERE clause contains a specific condition
function whereHasCondition(
  where: Record<string, unknown>,
  check: (condition: Record<string, unknown>) => boolean
): boolean {
  const conditions = (where.AND as Record<string, unknown>[]) ?? [where];
  return conditions.some(check);
}

describe("Property 15: Export filter and projection", () => {
  it("boolean filters produce exact match conditions", () => {
    fc.assert(
      fc.property(
        fc.record({
          isDead: fc.boolean(),
          canCall: fc.boolean(),
          canMail: fc.boolean(),
          householdAdmin: fc.boolean(),
        }),
        (boolFilters) => {
          const where = buildExportWhereClause(boolFilters);
          const conditions = where.AND as Record<string, unknown>[];

          expect(
            whereHasCondition(where, (c) => c.isDead === boolFilters.isDead)
          ).toBe(true);
          expect(
            whereHasCondition(where, (c) => c.canCall === boolFilters.canCall)
          ).toBe(true);
          expect(
            whereHasCondition(where, (c) => c.canMail === boolFilters.canMail)
          ).toBe(true);
          expect(
            whereHasCondition(
              where,
              (c) => c.householdAdmin === boolFilters.householdAdmin
            )
          ).toBe(true);
          expect(conditions).toHaveLength(4);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('"any" values produce non-null conditions', () => {
    fc.assert(
      fc.property(
        fc.record({
          field: fc.constantFrom(
            "disabledStatus",
            "incomeStatus",
            "group",
            "plainMountain"
          ),
        }),
        ({ field }) => {
          const query: ExportQuery = { [field]: "any" };
          const where = buildExportWhereClause(query);

          // The corresponding DB field should have a { not: null } condition
          const dbFieldMap: Record<string, string> = {
            disabledStatus: "disabledStatus",
            incomeStatus: "incomeStatus",
            group: "indigenousGroup",
            plainMountain: "plainMountain",
          };
          const dbField = dbFieldMap[field];

          expect(
            whereHasCondition(where, (c) => {
              const val = c[dbField] as { not: null } | undefined;
              return val !== undefined && val.not === null;
            })
          ).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("specific enum values produce exact match conditions", () => {
    fc.assert(
      fc.property(
        fc.record({
          sex: fc.constantFrom("male" as const, "female" as const),
          disabledStatus: fc.constantFrom(
            "light" as const,
            "mid" as const,
            "heavy" as const
          ),
          incomeStatus: fc.constantFrom(
            "low" as const,
            "mid_low" as const,
            "mid_low_elderly" as const
          ),
        }),
        (filters) => {
          const where = buildExportWhereClause(filters);

          expect(
            whereHasCondition(where, (c) => c.sex === filters.sex)
          ).toBe(true);
          expect(
            whereHasCondition(
              where,
              (c) => c.disabledStatus === filters.disabledStatus
            )
          ).toBe(true);
          expect(
            whereHasCondition(
              where,
              (c) => c.incomeStatus === filters.incomeStatus
            )
          ).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("partial match string filters produce contains conditions", () => {
    fc.assert(
      fc.property(
        fc.record({
          field: fc.constantFrom(
            "city",
            "dist",
            "name",
            "nameAlt",
            "tribe",
            "vill",
            "note"
          ),
          value: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        ({ field, value }) => {
          const query: ExportQuery = { [field]: value };
          const where = buildExportWhereClause(query);

          expect(
            whereHasCondition(where, (c) => {
              const val = c[field] as
                | { contains: string; mode: string }
                | undefined;
              return (
                val !== undefined &&
                val.contains === value &&
                val.mode === "insensitive"
              );
            })
          ).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("empty query produces empty WHERE clause", () => {
    const where = buildExportWhereClause({});
    expect(where).toEqual({});
  });

  it("age range filters produce birthday date conditions", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120 }),
        fc.integer({ min: 0, max: 120 }),
        (ageMin, ageMax) => {
          const query: ExportQuery = { ageMin, ageMax };
          const where = buildExportWhereClause(query);

          // Should have birthday lte (for ageMin) and gte (for ageMax)
          expect(
            whereHasCondition(where, (c) => {
              const val = c.birthday as { lte?: Date } | undefined;
              return val !== undefined && val.lte instanceof Date;
            })
          ).toBe(true);
          expect(
            whereHasCondition(where, (c) => {
              const val = c.birthday as { gte?: Date } | undefined;
              return val !== undefined && val.gte instanceof Date;
            })
          ).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("projectColumns selects only specified columns", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string(),
            city: fc.string(),
            dist: fc.string(),
            mobile: fc.string(),
            note: fc.string(),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        fc.subarray(["name", "city", "dist", "mobile", "note"], {
          minLength: 1,
        }),
        (records, columns) => {
          const projected = projectColumns(records, columns);

          for (const row of projected) {
            // Only selected columns should be present
            const keys = Object.keys(row);
            expect(keys.sort()).toEqual([...columns].sort());

            // Values should match original
            const originalIdx = projected.indexOf(row);
            for (const col of columns) {
              expect(row[col]).toEqual((records[originalIdx] as Record<string, unknown>)[col] ?? null);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
