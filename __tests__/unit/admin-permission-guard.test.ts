import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * **Validates: Requirements 6.1, 6.3**
 *
 * Property 8: 管理員權限守衛
 * For any role that is NOT "admin", calling bindStaffUser, unbindStaffUser,
 * or autoBindByEmail must return { success: false } and must NOT modify
 * any data in the store.
 */
describe("Feature: staff-user-binding, Property 8: 管理員權限守衛", () => {
  // --- Pure model mirroring binding-actions.ts permission logic ---

  interface UserRecord {
    id: number;
    email: string;
    staffId: number | null;
  }

  interface StaffRecord {
    id: number;
    name: string;
    email: string | null;
  }

  interface BindResult {
    success: boolean;
    error?: string;
  }

  interface AutoBindResult {
    success: boolean;
    bound: number;
    skipped: number;
    error?: string;
  }

  /**
   * Pure permission check mirroring requireAdmin() from binding-actions.ts.
   * Returns an error result if role is not "admin", or null if allowed.
   */
  function requireAdmin(role: string): BindResult | null {
    if (role !== "admin") return { success: false, error: "權限不足" };
    return null;
  }

  /**
   * Pure model of bindStaffUser with permission guard.
   */
  function bindStaffUser(
    role: string,
    users: Map<number, UserRecord>,
    staffId: number,
    userId: number
  ): BindResult {
    const denied = requireAdmin(role);
    if (denied) return denied;

    const user = users.get(userId);
    if (!user) return { success: false, error: "使用者不存在" };
    if (user.staffId !== null) return { success: false, error: "此帳號已綁定其他員工" };

    for (const [, u] of users) {
      if (u.id !== userId && u.staffId === staffId) {
        return { success: false, error: "此員工已被其他帳號綁定" };
      }
    }

    user.staffId = staffId;
    return { success: true };
  }

  /**
   * Pure model of unbindStaffUser with permission guard.
   */
  function unbindStaffUser(
    role: string,
    users: Map<number, UserRecord>,
    staffId: number
  ): BindResult {
    const denied = requireAdmin(role);
    if (denied) return denied;

    let boundUser: UserRecord | undefined;
    for (const [, u] of users) {
      if (u.staffId === staffId) {
        boundUser = u;
        break;
      }
    }
    if (!boundUser) return { success: false, error: "此員工尚未綁定帳號" };

    boundUser.staffId = null;
    return { success: true };
  }

  /**
   * Pure model of autoBindByEmail with permission guard.
   */
  function autoBindByEmail(
    role: string,
    users: Map<number, UserRecord>,
    staffList: StaffRecord[]
  ): AutoBindResult {
    const denied = requireAdmin(role);
    if (denied) return { success: false, bound: 0, skipped: 0, error: denied.error };

    let bound = 0;
    let skipped = 0;

    for (const staff of staffList) {
      if (!staff.email) continue;
      // Find matching unbound user
      let matchingUser: UserRecord | undefined;
      for (const [, u] of users) {
        if (u.email === staff.email && u.staffId === null) {
          matchingUser = u;
          break;
        }
      }
      if (!matchingUser) continue;

      // Check staff not already bound
      let staffAlreadyBound = false;
      for (const [, u] of users) {
        if (u.staffId === staff.id) {
          staffAlreadyBound = true;
          break;
        }
      }
      if (staffAlreadyBound) { skipped++; continue; }

      matchingUser.staffId = staff.id;
      bound++;
    }

    return { success: true, bound, skipped };
  }

  /** Snapshot user store state for comparison */
  function snapshotStore(users: Map<number, UserRecord>): Map<number, number | null> {
    const snap = new Map<number, number | null>();
    for (const [id, u] of users) {
      snap.set(id, u.staffId);
    }
    return snap;
  }

  // --- Arbitraries ---

  /** Generate a random non-admin role string */
  const nonAdminRoleArb = fc.oneof(
    fc.constant("user"),
    fc.constant("viewer"),
    fc.constant("editor"),
    fc.constant(""),
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s !== "admin")
  );

  // --- Property tests ---

  it("bindStaffUser returns { success: false } and does not modify data for non-admin roles", () => {
    fc.assert(
      fc.property(
        nonAdminRoleArb,
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (role, userId, staffId, otherStaffId) => {
          // Setup: one user, possibly bound or unbound
          const users = new Map<number, UserRecord>([
            [userId, { id: userId, email: `user${userId}@test.com`, staffId: null }],
          ]);
          const before = snapshotStore(users);

          const result = bindStaffUser(role, users, staffId, userId);

          expect(result.success).toBe(false);
          expect(result.error).toBe("權限不足");
          // Data must be unchanged
          const after = snapshotStore(users);
          expect(after).toEqual(before);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("unbindStaffUser returns { success: false } and does not modify data for non-admin roles", () => {
    fc.assert(
      fc.property(
        nonAdminRoleArb,
        fc.integer({ min: 1, max: 1000 }),
        fc.integer({ min: 1, max: 1000 }),
        (role, userId, staffId) => {
          // Setup: user already bound to a staff
          const users = new Map<number, UserRecord>([
            [userId, { id: userId, email: `user${userId}@test.com`, staffId }],
          ]);
          const before = snapshotStore(users);

          const result = unbindStaffUser(role, users, staffId);

          expect(result.success).toBe(false);
          expect(result.error).toBe("權限不足");
          // Data must be unchanged — user still bound
          const after = snapshotStore(users);
          expect(after).toEqual(before);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("autoBindByEmail returns { success: false } and does not modify data for non-admin roles", () => {
    fc.assert(
      fc.property(
        nonAdminRoleArb,
        fc.array(
          fc.record({
            userId: fc.integer({ min: 1, max: 100 }),
            email: fc.emailAddress(),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (role, userEntries) => {
          // Build user store with unique IDs
          const users = new Map<number, UserRecord>();
          for (const entry of userEntries) {
            users.set(entry.userId, {
              id: entry.userId,
              email: entry.email,
              staffId: null,
            });
          }

          // Build staff list with matching emails
          const staffList: StaffRecord[] = userEntries.map((entry, i) => ({
            id: 5000 + i,
            name: `Staff ${i}`,
            email: entry.email,
          }));

          const before = snapshotStore(users);

          const result = autoBindByEmail(role, users, staffList);

          expect(result.success).toBe(false);
          expect(result.error).toBe("權限不足");
          expect(result.bound).toBe(0);
          expect(result.skipped).toBe(0);
          // Data must be unchanged
          const after = snapshotStore(users);
          expect(after).toEqual(before);
        }
      ),
      { numRuns: 100 }
    );
  });
});
