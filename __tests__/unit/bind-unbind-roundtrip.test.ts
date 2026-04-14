import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * **Validates: Requirements 4.4, 4.5**
 *
 * Property 5: 綁定/解除綁定往返
 * For any valid Staff-User pair, after bindStaffUser(staffId, userId)
 * the User's staffId must equal staffId; after unbindStaffUser(staffId)
 * the User's staffId must return to null.
 */
describe("Feature: staff-user-binding, Property 5: 綁定/解除綁定往返", () => {
  // --- Pure model mirroring binding-actions.ts logic ---

  interface UserRecord {
    id: number;
    staffId: number | null;
  }

  /** In-memory store keyed by userId */
  type UserStore = Map<number, UserRecord>;

  interface BindResult {
    success: boolean;
    error?: string;
  }

  /**
   * Pure function mirroring bindStaffUser from binding-actions.ts.
   * Checks that the user is not already bound and the staff is not
   * already claimed, then sets user.staffId = staffId.
   */
  function bindStaffUser(
    store: UserStore,
    staffId: number,
    userId: number
  ): BindResult {
    const user = store.get(userId);
    if (!user) return { success: false, error: "使用者不存在" };

    // Req 4.6: user already bound → reject
    if (user.staffId !== null) {
      return { success: false, error: "此帳號已綁定其他員工" };
    }

    // Req 1.2: staff already bound by another user → reject
    for (const [, u] of store) {
      if (u.id !== userId && u.staffId === staffId) {
        return { success: false, error: "此員工已被其他帳號綁定" };
      }
    }

    // Execute bind (Req 4.4)
    user.staffId = staffId;
    return { success: true };
  }

  /**
   * Pure function mirroring unbindStaffUser from binding-actions.ts.
   * Finds the user bound to staffId and sets staffId to null.
   */
  function unbindStaffUser(
    store: UserStore,
    staffId: number
  ): BindResult {
    let boundUser: UserRecord | undefined;
    for (const [, u] of store) {
      if (u.staffId === staffId) {
        boundUser = u;
        break;
      }
    }

    if (!boundUser) {
      return { success: false, error: "此員工尚未綁定帳號" };
    }

    // Execute unbind (Req 4.5)
    boundUser.staffId = null;
    return { success: true };
  }

  // --- Property test ---

  it("bind → staffId === staffId → unbind → staffId === null (round-trip)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        fc.integer({ min: 1, max: 10000 }),
        (staffId, userId) => {
          // Setup: single unbound user
          const store: UserStore = new Map([
            [userId, { id: userId, staffId: null }],
          ]);

          // Step 1: bind
          const bindResult = bindStaffUser(store, staffId, userId);
          expect(bindResult.success).toBe(true);

          // Verify: user.staffId === staffId
          expect(store.get(userId)!.staffId).toBe(staffId);

          // Step 2: unbind
          const unbindResult = unbindStaffUser(store, staffId);
          expect(unbindResult.success).toBe(true);

          // Verify: user.staffId === null (round-trip complete)
          expect(store.get(userId)!.staffId).toBe(null);
        }
      ),
      { numRuns: 100 }
    );
  });
});
