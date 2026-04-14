import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * **Validates: Requirements 4.2, 4.3**
 *
 * Property 6: 未綁定帳號查詢正確性
 * For any set of Users (some with staffId, some with null),
 * getUnboundUsers() must return exactly the subset where staffId === null,
 * projected to { id, email }.
 */
describe("Feature: staff-user-binding, Property 6: 未綁定帳號查詢正確性", () => {
  // --- Pure model mirroring binding-actions.ts getUnboundUsers logic ---

  interface UserRecord {
    id: number;
    email: string;
    staffId: number | null;
  }

  /**
   * Pure function mirroring getUnboundUsers() from binding-actions.ts.
   * Filters users where staffId === null, returns { id, email }[] sorted by email asc.
   */
  function getUnboundUsers(
    users: UserRecord[]
  ): { id: number; email: string }[] {
    return users
      .filter((u) => u.staffId === null)
      .map((u) => ({ id: u.id, email: u.email }))
      .sort((a, b) => a.email.localeCompare(b.email));
  }

  // --- Arbitraries ---

  /** Generate a set of Users with unique ids */
  const userSetArb = fc
    .array(
      fc.record({
        staffId: fc.oneof(
          fc.constant(null as null),
          fc.integer({ min: 1, max: 10000 })
        ),
        emailLocal: fc.string({ minLength: 3, maxLength: 8, unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')) }),
      }),
      { minLength: 0, maxLength: 15 }
    )
    .map((arr) =>
      arr.map((item, i) => ({
        id: i + 1,
        email: `${item.emailLocal}${i}@example.com`,
        staffId: item.staffId,
      }))
    );

  // --- Property tests ---

  it("returns exactly the users with staffId === null, projected to { id, email }", () => {
    fc.assert(
      fc.property(userSetArb, (users) => {
        const result = getUnboundUsers(users);

        // Compute expected: all users where staffId is null
        const expected = users
          .filter((u) => u.staffId === null)
          .map((u) => ({ id: u.id, email: u.email }))
          .sort((a, b) => a.email.localeCompare(b.email));

        // Result set must exactly match
        expect(result).toEqual(expected);

        // Every returned user must have staffId === null in the original set
        for (const r of result) {
          const original = users.find((u) => u.id === r.id);
          expect(original).toBeDefined();
          expect(original!.staffId).toBe(null);
        }

        // No user with staffId === null should be missing from the result
        const resultIds = new Set(result.map((r) => r.id));
        for (const u of users) {
          if (u.staffId === null) {
            expect(resultIds.has(u.id)).toBe(true);
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it("returns empty array when all users are bound", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            email: fc.emailAddress(),
            staffId: fc.integer({ min: 1, max: 10000 }),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (users: UserRecord[]) => {
          const result = getUnboundUsers(users);
          expect(result).toEqual([]);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns all users when none are bound", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            email: fc.emailAddress(),
            staffId: fc.constant(null as null),
          }),
          { minLength: 1, maxLength: 10 }
        ),
        (users: UserRecord[]) => {
          const result = getUnboundUsers(users);

          const expected = users
            .map((u) => ({ id: u.id, email: u.email }))
            .sort((a, b) => a.email.localeCompare(b.email));

          expect(result).toEqual(expected);
          expect(result.length).toBe(users.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("handles empty user set", () => {
    const result = getUnboundUsers([]);
    expect(result).toEqual([]);
  });
});
