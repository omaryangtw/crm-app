import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Pure function replicating the performance aggregation logic from
 * app/(protected)/performance/page.tsx:
 *
 * Filter contacts by date range [startDate, endDate)
 * Aggregate total and successful count per staff member (many-to-many)
 */

interface StaffStub {
  name: string;
}

interface ContactStub {
  date: Date | null;
  isSuccess: boolean;
  staffInCharge: StaffStub[];
}

interface PerformanceRow {
  person: string;
  total: number;
  successful: number;
}

interface PerformanceResult {
  rows: PerformanceRow[];
  overallTotal: number;
  overallSuccessful: number;
}

function aggregatePerformance(
  contacts: ContactStub[],
  year: number,
  month: number
): PerformanceResult {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const filtered = contacts.filter((c) => {
    if (!c.date) return false;
    return c.date >= startDate && c.date < endDate;
  });

  const aggregation = new Map<string, { total: number; successful: number }>();
  let overallTotal = 0;
  let overallSuccessful = 0;

  for (const c of filtered) {
    overallTotal += 1;
    if (c.isSuccess) overallSuccessful += 1;

    const people = c.staffInCharge.length > 0
      ? c.staffInCharge.map((s) => s.name)
      : ["（未指定）"];

    for (const person of people) {
      if (!aggregation.has(person)) {
        aggregation.set(person, { total: 0, successful: 0 });
      }
      const entry = aggregation.get(person)!;
      entry.total += 1;
      if (c.isSuccess) {
        entry.successful += 1;
      }
    }
  }

  const rows = Array.from(aggregation.entries()).map(([person, stats]) => ({
    person,
    ...stats,
  }));

  return { rows, overallTotal, overallSuccessful };
}

// --- Arbitraries ---

const dateArb = fc.date({ min: new Date("2020-01-01"), max: new Date("2026-12-31") });
const nullableDateArb = fc.oneof(fc.constant(null), dateArb);

const staffStubArb = fc.record({
  name: fc.constantFrom("Alice", "Bob", "Charlie", "Diana"),
});

const contactArb: fc.Arbitrary<ContactStub> = fc.record({
  date: nullableDateArb,
  isSuccess: fc.boolean(),
  staffInCharge: fc.array(staffStubArb, { minLength: 0, maxLength: 3 }),
});

const yearMonthArb = fc.record({
  year: fc.integer({ min: 2020, max: 2026 }),
  month: fc.integer({ min: 1, max: 12 }),
});

/**
 * **Validates: Requirements 16.1, 16.2**
 *
 * Property 10: Performance history aggregation
 * Overall totals are correct for the date range.
 * Correct date range filtering.
 */
describe("Feature: crm-modernization, Property 10: Performance history aggregation", () => {
  it("overall totals match filtered contact count", () => {
    fc.assert(
      fc.property(
        fc.array(contactArb, { minLength: 0, maxLength: 50 }),
        yearMonthArb,
        (contacts, { year, month }) => {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 1);
          const result = aggregatePerformance(contacts, year, month);

          const inRange = contacts.filter(
            (c) => c.date !== null && c.date >= startDate && c.date < endDate
          );

          expect(result.overallTotal).toBe(inRange.length);
          expect(result.overallSuccessful).toBe(
            inRange.filter((c) => c.isSuccess).length
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it("only contacts within the date range are counted", () => {
    fc.assert(
      fc.property(
        fc.array(contactArb, { minLength: 0, maxLength: 50 }),
        yearMonthArb,
        (contacts, { year, month }) => {
          const startDate = new Date(year, month - 1, 1);
          const endDate = new Date(year, month, 1);

          const result = aggregatePerformance(contacts, year, month);

          // Manually count contacts in range
          const inRange = contacts.filter(
            (c) => c.date !== null && c.date >= startDate && c.date < endDate
          );

          expect(result.overallTotal).toBe(inRange.length);
          expect(result.overallSuccessful).toBe(
            inRange.filter((c) => c.isSuccess).length
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it("contacts outside the date range are excluded", () => {
    fc.assert(
      fc.property(
        yearMonthArb,
        fc.array(
          fc.record({
            isSuccess: fc.boolean(),
            staffInCharge: fc.array(staffStubArb, { minLength: 0, maxLength: 2 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        ({ year, month }, partials) => {
          // Create contacts with dates outside the target month
          const startDate = new Date(year, month - 1, 1);
          const contacts: ContactStub[] = partials.map((p) => ({
            ...p,
            // One day before the start
            date: new Date(startDate.getTime() - 86400000),
          }));

          const result = aggregatePerformance(contacts, year, month);
          expect(result.overallTotal).toBe(0);
          expect(result.rows.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("null-date contacts are excluded", () => {
    fc.assert(
      fc.property(
        yearMonthArb,
        fc.array(
          fc.record({
            date: fc.constant(null as Date | null),
            isSuccess: fc.boolean(),
            staffInCharge: fc.array(staffStubArb, { minLength: 0, maxLength: 2 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        ({ year, month }, contacts) => {
          const result = aggregatePerformance(contacts, year, month);
          expect(result.overallTotal).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
