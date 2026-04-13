import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * Pure function replicating the household check logic from
 * app/(protected)/clients/household-check/page.tsx:
 *
 * 1. Filter to canMail=true and addr not null
 * 2. Group by addr
 * 3. Return clients from groups with zero householdAdmin
 */
interface HouseholdClient {
  id: number;
  name: string | null;
  addr: string;
  canMail: boolean;
  householdAdmin: boolean;
}

function findFlaggedClients(clients: HouseholdClient[]): HouseholdClient[] {
  // Filter to canMail=true and addr not null (already guaranteed by type)
  const eligible = clients.filter((c) => c.canMail);

  // Group by addr
  const grouped = new Map<string, HouseholdClient[]>();
  for (const c of eligible) {
    if (!grouped.has(c.addr)) grouped.set(c.addr, []);
    grouped.get(c.addr)!.push(c);
  }

  // Return clients from groups with zero householdAdmin
  const flagged: HouseholdClient[] = [];
  for (const [, group] of grouped) {
    if (!group.some((c) => c.householdAdmin)) {
      flagged.push(...group);
    }
  }
  return flagged;
}

// --- Arbitraries ---

const addrArb = fc
  .array(fc.constantFrom("A", "B", "C", "D", "E", "1", "2", "路", "巷"), {
    minLength: 1,
    maxLength: 15,
  })
  .map((chars) => chars.join(""));

const householdClientArb: fc.Arbitrary<HouseholdClient> = fc.record({
  id: fc.nat({ max: 100000 }),
  name: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 20 })),
  addr: addrArb,
  canMail: fc.boolean(),
  householdAdmin: fc.boolean(),
});

/**
 * **Validates: Requirements 7.1**
 *
 * Property 7: Household check correctness
 * The household check returns exactly those clients whose address is not null
 * and canMail is true, grouped by address, where the count of householdAdmin=true
 * within that address group is zero.
 */
describe("Feature: crm-modernization, Property 7: Household check correctness", () => {
  it("address groups with at least one householdAdmin are NOT flagged", () => {
    fc.assert(
      fc.property(
        // Generate a group of clients sharing the same address, with at least one admin
        addrArb,
        fc.array(
          fc.record({
            id: fc.nat({ max: 100000 }),
            name: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 20 })),
            canMail: fc.constant(true),
            householdAdmin: fc.boolean(),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (addr, partials) => {
          // Ensure at least one admin exists in the group
          const clients: HouseholdClient[] = partials.map((p) => ({ ...p, addr }));
          clients[0] = { ...clients[0], householdAdmin: true };

          const flagged = findFlaggedClients(clients);

          // None of these clients should be flagged
          for (const c of clients) {
            expect(flagged.find((f) => f.id === c.id)).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("address groups with zero householdAdmin → ALL eligible clients in group are flagged", () => {
    fc.assert(
      fc.property(
        addrArb,
        fc.array(
          fc.record({
            id: fc.nat({ max: 100000 }),
            name: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 20 })),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (addr, partials) => {
          // All canMail=true, none are admin
          const clients: HouseholdClient[] = partials.map((p) => ({
            ...p,
            addr,
            canMail: true,
            householdAdmin: false,
          }));

          const flagged = findFlaggedClients(clients);

          // Every client in this group should be flagged
          for (const c of clients) {
            expect(flagged.find((f) => f.id === c.id)).toBeDefined();
          }
          expect(flagged.length).toBe(clients.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("full partition: flagged clients come only from groups with zero admins", () => {
    fc.assert(
      fc.property(
        fc.array(householdClientArb, { minLength: 0, maxLength: 50 }),
        (rawClients) => {
          // Assign unique IDs to avoid duplicate-ID collisions in assertions
          const clients = rawClients.map((c, i) => ({ ...c, id: i + 1 }));

          const flagged = findFlaggedClients(clients);

          // Build the same grouping to verify
          const eligible = clients.filter((c) => c.canMail);
          const grouped = new Map<string, HouseholdClient[]>();
          for (const c of eligible) {
            if (!grouped.has(c.addr)) grouped.set(c.addr, []);
            grouped.get(c.addr)!.push(c);
          }

          // Identify which addresses have zero admins
          const noAdminAddrs = new Set<string>();
          for (const [addr, group] of grouped) {
            if (!group.some((c) => c.householdAdmin)) {
              noAdminAddrs.add(addr);
            }
          }

          // Every flagged client must be canMail=true and from a no-admin address
          for (const f of flagged) {
            expect(f.canMail).toBe(true);
            expect(noAdminAddrs.has(f.addr)).toBe(true);
          }

          // Every eligible client from a no-admin address must be flagged
          for (const [addr, group] of grouped) {
            if (noAdminAddrs.has(addr)) {
              for (const c of group) {
                expect(flagged.find((f) => f.id === c.id)).toBeDefined();
              }
            }
          }

          // Clients with canMail=false should never be flagged
          const nonEligible = clients.filter((c) => !c.canMail);
          for (const c of nonEligible) {
            expect(flagged.find((f) => f.id === c.id)).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
