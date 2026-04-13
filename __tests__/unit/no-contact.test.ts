import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Pure function replicating the no-contact list logic from
 * app/(protected)/contacts/no-contact/page.tsx:
 *
 * Filter: isDead=false, plainMountain="plain", zero successful contacts
 * Sort: by client createdAt ASC
 */

interface ContactStub {
  isSuccess: boolean;
}

interface ClientWithContacts {
  id: number;
  name: string | null;
  birthday: Date | null;
  isDead: boolean;
  plainMountain: string | null;
  createdAt: Date;
  contacts: ContactStub[];
}

interface NoContactRow {
  id: number;
  name: string | null;
  birthday: Date | null;
  successfulCount: number;
  createdAt: Date;
}

function filterAndSortNoContact(clients: ClientWithContacts[]): NoContactRow[] {
  return clients
    .filter(
      (c) =>
        !c.isDead &&
        c.plainMountain === "plain" &&
        !c.contacts.some((ct) => ct.isSuccess)
    )
    .map((c) => ({
      id: c.id,
      name: c.name,
      birthday: c.birthday,
      successfulCount: 0,
      createdAt: c.createdAt,
    }))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

// --- Arbitraries ---

const dateArb = fc.date({ min: new Date("2000-01-01"), max: new Date("2025-12-31") });
const nullableDateArb = fc.oneof(fc.constant(null), dateArb);
const nullableStringArb = fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 20 }));

const contactArb: fc.Arbitrary<ContactStub> = fc.record({
  isSuccess: fc.boolean(),
});

const clientArb: fc.Arbitrary<ClientWithContacts> = fc.record({
  id: fc.nat({ max: 100000 }),
  name: nullableStringArb,
  birthday: nullableDateArb,
  isDead: fc.boolean(),
  plainMountain: fc.oneof(fc.constant("plain"), fc.constant("mountain"), fc.constant(null)),
  createdAt: dateArb,
  contacts: fc.array(contactArb, { minLength: 0, maxLength: 10 }),
});

/**
 * **Validates: Requirements 14.1, 14.2**
 *
 * Property 9: No-contact list filter and sort
 * Only clients with zero successful contacts appear, sorted by createdAt ASC.
 */
describe("Feature: crm-modernization, Property 9: No-contact list filter and sort", () => {
  it("only includes clients with zero successful contacts matching filter conditions", () => {
    fc.assert(
      fc.property(
        fc.array(clientArb, { minLength: 0, maxLength: 30 }),
        (clients) => {
          const withIds = clients.map((c, i) => ({ ...c, id: i + 1 }));
          const result = filterAndSortNoContact(withIds);

          for (const row of result) {
            const original = withIds.find((c) => c.id === row.id)!;
            expect(original.isDead).toBe(false);
            expect(original.plainMountain).toBe("plain");
            expect(original.contacts.some((ct) => ct.isSuccess)).toBe(false);
            expect(row.successfulCount).toBe(0);
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
          const result = filterAndSortNoContact(withIds);
          const resultIds = new Set(result.map((r) => r.id));

          for (const c of withIds) {
            if (resultIds.has(c.id)) continue;
            const violates =
              c.isDead ||
              c.plainMountain !== "plain" ||
              c.contacts.some((ct) => ct.isSuccess);
            expect(violates).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("results are sorted by createdAt ASC", () => {
    fc.assert(
      fc.property(
        fc.array(clientArb, { minLength: 0, maxLength: 30 }),
        (clients) => {
          const withIds = clients.map((c, i) => ({ ...c, id: i + 1 }));
          const result = filterAndSortNoContact(withIds);

          for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].createdAt.getTime()).toBeLessThanOrEqual(
              result[i].createdAt.getTime()
            );
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
