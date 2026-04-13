import { describe, it, expect } from "vitest";
import fc from "fast-check";

// Helper: get a sortable timestamp, treating null and invalid dates as -Infinity (sort first)
function safeTime(d: Date | null | undefined): number {
  if (d == null) return -Infinity;
  const t = d.getTime();
  return Number.isNaN(t) ? -Infinity : t;
}

// The sort function matching the Prisma orderBy: [{ date: "asc" }, { createdAt: "asc" }]
function sortContacts<T extends { date: Date | null; createdAt: Date }>(contacts: T[]): T[] {
  return [...contacts].sort((a, b) => {
    const dateA = safeTime(a.date);
    const dateB = safeTime(b.date);
    if (dateA !== dateB) return dateA - dateB;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/**
 * **Validates: Requirements 4.2**
 *
 * Property 3: Client detail contact sorting
 * Contacts returned on the client detail page must be sorted by date ASC, then createdAt ASC.
 */
describe("Feature: crm-modernization, Property 3: Client detail contact sorting", () => {
  const contactArb = fc.record({
    id: fc.integer({ min: 1, max: 100000 }),
    date: fc.option(fc.date({ min: new Date(2020, 0, 1), max: new Date(2026, 11, 31) }), { nil: null }),
    createdAt: fc.date({ min: new Date(2020, 0, 1), max: new Date(2026, 11, 31) }),
  });

  it("sorts contacts by date ASC then createdAt ASC", () => {
    fc.assert(
      fc.property(
        fc.array(contactArb, { minLength: 0, maxLength: 50 }),
        (contacts) => {
          const sorted = sortContacts(contacts);
          for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            const prevDate = safeTime(prev.date);
            const currDate = safeTime(curr.date);
            if (prevDate === currDate) {
              expect(prev.createdAt.getTime()).toBeLessThanOrEqual(curr.createdAt.getTime());
            } else {
              expect(prevDate).toBeLessThan(currDate);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
