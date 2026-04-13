import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Pure function replicating the Prisma WHERE clause from the birthday page:
 *   birthday IS NOT NULL AND addr IS NOT NULL AND (phone IS NOT NULL OR mobile IS NOT NULL)
 */
function matchesBirthdayFilter(client: {
  birthday: Date | null;
  addr: string | null;
  phone: string | null;
  mobile: string | null;
}): boolean {
  return (
    client.birthday !== null &&
    client.addr !== null &&
    (client.phone !== null || client.mobile !== null)
  );
}

// --- Arbitraries ---

const nullableDateArb = fc.oneof(
  fc.constant(null),
  fc.date({ min: new Date("1920-01-01"), max: new Date("2024-12-31") })
);

const nullableStringArb = fc.oneof(
  fc.constant(null),
  fc.string({ minLength: 1, maxLength: 30 })
);

const clientArb = fc.record({
  birthday: nullableDateArb,
  addr: nullableStringArb,
  phone: nullableStringArb,
  mobile: nullableStringArb,
});

/**
 * **Validates: Requirements 6.1**
 *
 * Property 6: Birthday list filter invariant
 * The birthday list contains exactly those clients where
 * birthday IS NOT NULL AND addr IS NOT NULL AND (phone IS NOT NULL OR mobile IS NOT NULL).
 */
describe("Feature: crm-modernization, Property 6: Birthday list filter invariant", () => {
  it("clients matching all conditions are included", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("1920-01-01"), max: new Date("2024-12-31") }),
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.oneof(
          // At least one of phone/mobile is non-null
          fc.record({
            phone: fc.string({ minLength: 1, maxLength: 20 }),
            mobile: nullableStringArb,
          }),
          fc.record({
            phone: nullableStringArb,
            mobile: fc.string({ minLength: 1, maxLength: 20 }),
          })
        ),
        (birthday, addr, phones) => {
          const client = { birthday, addr, phone: phones.phone, mobile: phones.mobile };
          expect(matchesBirthdayFilter(client)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("clients with null birthday are excluded", () => {
    fc.assert(
      fc.property(
        nullableStringArb,
        nullableStringArb,
        nullableStringArb,
        (addr, phone, mobile) => {
          const client = { birthday: null, addr, phone, mobile };
          expect(matchesBirthdayFilter(client)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("clients with null addr are excluded", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("1920-01-01"), max: new Date("2024-12-31") }),
        nullableStringArb,
        nullableStringArb,
        (birthday, phone, mobile) => {
          const client = { birthday, addr: null, phone, mobile };
          expect(matchesBirthdayFilter(client)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("clients with both phone and mobile null are excluded", () => {
    fc.assert(
      fc.property(
        nullableDateArb,
        nullableStringArb,
        (birthday, addr) => {
          const client = { birthday, addr, phone: null, mobile: null };
          expect(matchesBirthdayFilter(client)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("filter partitions the full client set correctly", () => {
    fc.assert(
      fc.property(
        fc.array(clientArb, { minLength: 0, maxLength: 50 }),
        (clients) => {
          const included = clients.filter(matchesBirthdayFilter);
          const excluded = clients.filter((c) => !matchesBirthdayFilter(c));

          // Every included client satisfies all three conditions
          for (const c of included) {
            expect(c.birthday).not.toBeNull();
            expect(c.addr).not.toBeNull();
            expect(c.phone !== null || c.mobile !== null).toBe(true);
          }

          // Every excluded client violates at least one condition
          for (const c of excluded) {
            const violates =
              c.birthday === null ||
              c.addr === null ||
              (c.phone === null && c.mobile === null);
            expect(violates).toBe(true);
          }

          // Partition is exhaustive
          expect(included.length + excluded.length).toBe(clients.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
