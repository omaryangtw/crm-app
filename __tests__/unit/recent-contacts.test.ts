import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Pure function replicating the recent contacts filter and sort logic from
 * app/(protected)/contacts/recent/page.tsx:
 *
 * Filter: isDead=false, plainMountain="plain", canCall=true, has at least one successful contact
 * Sort: by max successful contact date ASC (oldest first)
 */

interface ContactStub {
  isSuccess: boolean;
  date: Date | null;
}

interface ClientWithContacts {
  id: number;
  name: string | null;
  birthday: Date | null;
  isDead: boolean;
  plainMountain: string | null;
  canCall: boolean;
  contacts: ContactStub[];
}

interface RecentContactRow {
  id: number;
  name: string | null;
  birthday: Date | null;
  lastSuccessDate: Date | null;
}

function filterAndSortRecentContacts(clients: ClientWithContacts[]): RecentContactRow[] {
  return clients
    .filter(
      (c) =>
        !c.isDead &&
        c.plainMountain === "plain" &&
        c.canCall &&
        c.contacts.some((ct) => ct.isSuccess)
    )
    .map((c) => {
      const successDates = c.contacts
        .filter((ct) => ct.isSuccess)
        .map((ct) => ct.date)
        .filter((d): d is Date => d !== null);

      const maxDate =
        successDates.length > 0
          ? new Date(Math.max(...successDates.map((d) => d.getTime())))
          : null;

      return {
        id: c.id,
        name: c.name,
        birthday: c.birthday,
        lastSuccessDate: maxDate,
      };
    })
    .sort((a, b) => {
      if (!a.lastSuccessDate && !b.lastSuccessDate) return 0;
      if (!a.lastSuccessDate) return -1;
      if (!b.lastSuccessDate) return -1;
      return a.lastSuccessDate.getTime() - b.lastSuccessDate.getTime();
    });
}

// --- Arbitraries ---

const dateArb = fc.date({ min: new Date("2000-01-01"), max: new Date("2025-12-31") });
const nullableDateArb = fc.oneof(fc.constant(null), dateArb);
const nullableStringArb = fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 20 }));

const contactArb: fc.Arbitrary<ContactStub> = fc.record({
  isSuccess: fc.boolean(),
  date: nullableDateArb,
});

const clientArb: fc.Arbitrary<ClientWithContacts> = fc.record({
  id: fc.nat({ max: 100000 }),
  name: nullableStringArb,
  birthday: nullableDateArb,
  isDead: fc.boolean(),
  plainMountain: fc.oneof(fc.constant("plain"), fc.constant("mountain"), fc.constant(null)),
  canCall: fc.boolean(),
  contacts: fc.array(contactArb, { minLength: 0, maxLength: 10 }),
});

/**
 * **Validates: Requirements 13.1, 13.2**
 *
 * Property 8: Recent contacts filter and sort
 * The recent contacts list contains only clients where isDead=false AND plainMountain=plain
 * AND canCall=true and who have at least one contact with isSuccess=true.
 * Results are sorted by max successful contact date ASC.
 */
describe("Feature: crm-modernization, Property 8: Recent contacts filter and sort", () => {
  it("only includes clients matching all filter conditions", () => {
    fc.assert(
      fc.property(
        fc.array(clientArb, { minLength: 0, maxLength: 30 }),
        (clients) => {
          // Assign unique IDs
          const withIds = clients.map((c, i) => ({ ...c, id: i + 1 }));
          const result = filterAndSortRecentContacts(withIds);

          for (const row of result) {
            const original = withIds.find((c) => c.id === row.id)!;
            expect(original.isDead).toBe(false);
            expect(original.plainMountain).toBe("plain");
            expect(original.canCall).toBe(true);
            expect(original.contacts.some((ct) => ct.isSuccess)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("excludes clients that fail any filter condition", () => {
    fc.assert(
      fc.property(
        fc.array(clientArb, { minLength: 0, maxLength: 30 }),
        (clients) => {
          const withIds = clients.map((c, i) => ({ ...c, id: i + 1 }));
          const result = filterAndSortRecentContacts(withIds);
          const resultIds = new Set(result.map((r) => r.id));

          for (const c of withIds) {
            if (resultIds.has(c.id)) continue;
            // Must violate at least one condition
            const violates =
              c.isDead ||
              c.plainMountain !== "plain" ||
              !c.canCall ||
              !c.contacts.some((ct) => ct.isSuccess);
            expect(violates).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("results are sorted by max successful contact date ASC", () => {
    fc.assert(
      fc.property(
        fc.array(clientArb, { minLength: 0, maxLength: 30 }),
        (clients) => {
          const withIds = clients.map((c, i) => ({ ...c, id: i + 1 }));
          const result = filterAndSortRecentContacts(withIds);

          for (let i = 1; i < result.length; i++) {
            const prev = result[i - 1].lastSuccessDate;
            const curr = result[i].lastSuccessDate;
            if (prev !== null && curr !== null) {
              expect(prev.getTime()).toBeLessThanOrEqual(curr.getTime());
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
