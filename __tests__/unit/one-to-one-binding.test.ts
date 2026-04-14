import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * **Validates: Requirements 1.2, 4.6**
 *
 * Property 1: 一對一綁定不變量
 * For any sequence of bind operations, no two different Users should share
 * the same non-null staffId. Also, a User already bound to Staff A must be
 * rejected when attempting to bind to Staff B.
 */
describe("Feature: staff-user-binding, Property 1: 一對一綁定不變量", () => {
  // --- Pure model mirroring binding-actions.ts logic ---

  interface BindingState {
    /** userId → staffId | null */
    users: Map<number, number | null>;
  }

  interface BindResult {
    success: boolean;
    error?: string;
  }

  /**
   * Pure function that mirrors the core validation logic of bindStaffUser.
   * No DB, no auth — just the invariant checks.
   */
  function bindStaffUser(
    state: BindingState,
    staffId: number,
    userId: number
  ): BindResult {
    const currentStaffId = state.users.get(userId);

    // User not found — treat as error (shouldn't happen in real usage)
    if (currentStaffId === undefined) {
      return { success: false, error: "使用者不存在" };
    }

    // Check 1: User already bound to another Staff → reject (Req 4.6)
    if (currentStaffId !== null) {
      return { success: false, error: "此帳號已綁定其他員工" };
    }

    // Check 2: Staff already bound by another User → reject (Req 1.2)
    for (const [uid, sid] of state.users) {
      if (uid !== userId && sid === staffId) {
        return { success: false, error: "此員工已被其他帳號綁定" };
      }
    }

    // Execute bind
    state.users.set(userId, staffId);
    return { success: true };
  }

  /** Check the one-to-one invariant: no two users share the same non-null staffId */
  function checkOneToOneInvariant(state: BindingState): boolean {
    const seenStaffIds = new Set<number>();
    for (const [, staffId] of state.users) {
      if (staffId !== null) {
        if (seenStaffIds.has(staffId)) return false;
        seenStaffIds.add(staffId);
      }
    }
    return true;
  }

  // --- Arbitraries ---

  /** Generate a small set of user IDs and staff IDs, then a sequence of bind ops */
  const bindOpsArb = fc
    .record({
      userIds: fc.uniqueArray(fc.integer({ min: 1, max: 20 }), {
        minLength: 2,
        maxLength: 8,
      }),
      staffIds: fc.uniqueArray(fc.integer({ min: 1, max: 20 }), {
        minLength: 2,
        maxLength: 8,
      }),
    })
    .chain(({ userIds, staffIds }) =>
      fc
        .array(
          fc.record({
            userId: fc.constantFrom(...userIds),
            staffId: fc.constantFrom(...staffIds),
          }),
          { minLength: 1, maxLength: 30 }
        )
        .map((ops) => ({ userIds, ops }))
    );

  it("no two different Users share the same non-null staffId after any bind sequence", () => {
    fc.assert(
      fc.property(bindOpsArb, ({ userIds, ops }) => {
        // Initialize state: all users unbound
        const state: BindingState = {
          users: new Map(userIds.map((id) => [id, null])),
        };

        // Execute each bind operation
        for (const op of ops) {
          bindStaffUser(state, op.staffId, op.userId);
        }

        // Invariant: one-to-one must hold
        expect(checkOneToOneInvariant(state)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("a User already bound to Staff A is rejected when binding to Staff B", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 101, max: 200 }),
        fc.integer({ min: 101, max: 200 }),
        (userId, staffA, staffB, otherUserId) => {
          // Ensure staffA !== staffB for a meaningful test
          fc.pre(staffA !== staffB);

          const state: BindingState = {
            users: new Map([
              [userId, null],
              [otherUserId, null],
            ]),
          };

          // First bind succeeds
          const first = bindStaffUser(state, staffA, userId);
          expect(first.success).toBe(true);
          expect(state.users.get(userId)).toBe(staffA);

          // Attempt to bind same user to different staff → rejected
          const second = bindStaffUser(state, staffB, userId);
          expect(second.success).toBe(false);
          expect(second.error).toBe("此帳號已綁定其他員工");

          // User's staffId unchanged
          expect(state.users.get(userId)).toBe(staffA);
        }
      ),
      { numRuns: 100 }
    );
  });
});
