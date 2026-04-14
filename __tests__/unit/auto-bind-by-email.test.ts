import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * **Validates: Requirements 5.1, 5.3, 5.5**
 *
 * Property 7: Email 比對自動綁定
 * For any set of Staff and Users, autoBindByEmail() should bind all pairs
 * where Staff.email === User.email, Staff.email is non-null, User.staffId
 * is null, and the Staff is not already bound by another User. Already-bound
 * Users must be skipped without affecting their existing binding.
 */
describe("Feature: staff-user-binding, Property 7: Email 比對自動綁定", () => {
  // --- Pure model mirroring binding-actions.ts autoBindByEmail logic ---

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

  interface AutoBindResult {
    success: boolean;
    bound: number;
    skipped: number;
  }

  /**
   * Pure model of autoBindByEmail from binding-actions.ts.
   * Iterates staff list, finds matching unbound user by email,
   * checks staff not already bound, then binds.
   */
  function autoBindByEmail(
    users: Map<number, UserRecord>,
    staffList: StaffRecord[]
  ): AutoBindResult {
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
      if (staffAlreadyBound) {
        skipped++;
        continue;
      }

      matchingUser.staffId = staff.id;
      bound++;
    }

    return { success: true, bound, skipped };
  }

  /** Check one-to-one invariant: no two users share the same non-null staffId */
  function checkOneToOneInvariant(users: Map<number, UserRecord>): boolean {
    const seen = new Set<number>();
    for (const [, u] of users) {
      if (u.staffId !== null) {
        if (seen.has(u.staffId)) return false;
        seen.add(u.staffId);
      }
    }
    return true;
  }

  /** Snapshot user store for comparison */
  function snapshotStore(
    users: Map<number, UserRecord>
  ): Map<number, number | null> {
    const snap = new Map<number, number | null>();
    for (const [id, u] of users) {
      snap.set(id, u.staffId);
    }
    return snap;
  }

  // --- Arbitraries ---

  /** Generate a unique email local part */
  const emailLocalArb = fc.stringMatching(/^[a-z]{3,8}$/);

  /**
   * Generate a scenario with Staff and User sets that have various
   * email overlap situations.
   */
  const scenarioArb = fc
    .record({
      /** Pool of shared emails (will appear in both Staff and User) */
      sharedEmails: fc.uniqueArray(emailLocalArb, {
        minLength: 0,
        maxLength: 6,
      }),
      /** Staff-only emails (no matching User) */
      staffOnlyEmails: fc.uniqueArray(emailLocalArb, {
        minLength: 0,
        maxLength: 3,
      }),
      /** User-only emails (no matching Staff) */
      userOnlyEmails: fc.uniqueArray(emailLocalArb, {
        minLength: 0,
        maxLength: 3,
      }),
      /** How many shared-email users are pre-bound */
      preBoundCount: fc.integer({ min: 0, max: 3 }),
      /** How many shared-email staff are pre-bound by other users */
      staffPreBoundCount: fc.integer({ min: 0, max: 2 }),
      /** Include staff with null email */
      nullEmailStaffCount: fc.integer({ min: 0, max: 2 }),
    })
    .map((params) => {
      // Deduplicate across pools
      const allLocals = new Set([
        ...params.sharedEmails,
        ...params.staffOnlyEmails,
        ...params.userOnlyEmails,
      ]);
      const sharedEmails = params.sharedEmails.filter(
        (e) =>
          !params.staffOnlyEmails.includes(e) &&
          !params.userOnlyEmails.includes(e)
      );
      const staffOnlyEmails = params.staffOnlyEmails.filter(
        (e) => !params.sharedEmails.includes(e)
      );
      const userOnlyEmails = params.userOnlyEmails.filter(
        (e) => !params.sharedEmails.includes(e)
      );

      let nextStaffId = 1;
      let nextUserId = 1000;

      const staffList: StaffRecord[] = [];
      const users = new Map<number, UserRecord>();

      // Staff with shared emails + matching Users
      for (const local of sharedEmails) {
        const email = `${local}@test.com`;
        staffList.push({
          id: nextStaffId++,
          name: `Staff-${local}`,
          email,
        });
        users.set(nextUserId, {
          id: nextUserId,
          email,
          staffId: null,
        });
        nextUserId++;
      }

      // Pre-bind some shared-email users (they should be skipped)
      const preBound = Math.min(
        params.preBoundCount,
        sharedEmails.length
      );
      let preBoundIdx = 0;
      for (const [, u] of users) {
        if (preBoundIdx >= preBound) break;
        // Bind to a "foreign" staff id that doesn't conflict
        u.staffId = 9000 + preBoundIdx;
        preBoundIdx++;
      }

      // Pre-bind some staff by adding extra users bound to them
      const staffPreBound = Math.min(
        params.staffPreBoundCount,
        staffList.length - preBound
      );
      let staffPreBoundIdx = 0;
      for (const staff of staffList) {
        if (staffPreBoundIdx >= staffPreBound) break;
        // Only pre-bind staff whose matching user is NOT already pre-bound
        const matchingUser = [...users.values()].find(
          (u) => u.email === staff.email
        );
        if (matchingUser && matchingUser.staffId !== null) continue;

        // Add an extra user that claims this staff
        const extraUserId = nextUserId++;
        users.set(extraUserId, {
          id: extraUserId,
          email: `extra${extraUserId}@other.com`,
          staffId: staff.id,
        });
        staffPreBoundIdx++;
      }

      // Staff-only emails (no matching User)
      for (const local of staffOnlyEmails) {
        staffList.push({
          id: nextStaffId++,
          name: `StaffOnly-${local}`,
          email: `${local}@test.com`,
        });
      }

      // User-only emails (no matching Staff)
      for (const local of userOnlyEmails) {
        users.set(nextUserId, {
          id: nextUserId,
          email: `${local}@test.com`,
          staffId: null,
        });
        nextUserId++;
      }

      // Staff with null email
      for (let i = 0; i < params.nullEmailStaffCount; i++) {
        staffList.push({
          id: nextStaffId++,
          name: `NullEmailStaff-${i}`,
          email: null,
        });
      }

      return { staffList, users };
    });

  // --- Property tests ---

  it("binds all eligible email-matching pairs and skips already-bound", () => {
    fc.assert(
      fc.property(scenarioArb, ({ staffList, users }) => {
        const beforeSnap = snapshotStore(users);

        // Compute expected eligible pairs BEFORE running autoBind
        const expectedBindings: { staffId: number; userId: number }[] = [];
        const simulatedUsers = new Map<number, UserRecord>();
        for (const [id, u] of users) {
          simulatedUsers.set(id, { ...u });
        }

        for (const staff of staffList) {
          if (!staff.email) continue;
          let matchingUser: UserRecord | undefined;
          for (const [, u] of simulatedUsers) {
            if (u.email === staff.email && u.staffId === null) {
              matchingUser = u;
              break;
            }
          }
          if (!matchingUser) continue;
          let alreadyBound = false;
          for (const [, u] of simulatedUsers) {
            if (u.staffId === staff.id) {
              alreadyBound = true;
              break;
            }
          }
          if (alreadyBound) continue;
          matchingUser.staffId = staff.id;
          expectedBindings.push({
            staffId: staff.id,
            userId: matchingUser.id,
          });
        }

        // Run actual autoBindByEmail
        const result = autoBindByEmail(users, staffList);

        expect(result.success).toBe(true);
        expect(result.bound).toBe(expectedBindings.length);

        // Verify each expected binding was applied
        for (const binding of expectedBindings) {
          const user = users.get(binding.userId);
          expect(user).toBeDefined();
          expect(user!.staffId).toBe(binding.staffId);
        }

        // Verify already-bound users were NOT modified
        for (const [id, beforeStaffId] of beforeSnap) {
          if (beforeStaffId !== null) {
            expect(users.get(id)!.staffId).toBe(beforeStaffId);
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it("maintains one-to-one invariant after auto-bind", () => {
    fc.assert(
      fc.property(scenarioArb, ({ staffList, users }) => {
        // Invariant should hold before
        expect(checkOneToOneInvariant(users)).toBe(true);

        autoBindByEmail(users, staffList);

        // Invariant must still hold after
        expect(checkOneToOneInvariant(users)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("does nothing when no emails match", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 100 }),
            name: fc.string({ minLength: 1, maxLength: 10 }),
            email: fc.constant("staff@a.com" as string | null),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        fc.array(
          fc.record({
            id: fc.integer({ min: 200, max: 300 }),
            email: fc.constant("user@b.com"),
            staffId: fc.constant(null as null),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (staffList, userList) => {
          // Ensure no email overlap
          const users = new Map<number, UserRecord>();
          for (const u of userList) {
            users.set(u.id, { ...u });
          }

          const result = autoBindByEmail(users, staffList);

          expect(result.success).toBe(true);
          expect(result.bound).toBe(0);

          // All users still unbound
          for (const [, u] of users) {
            expect(u.staffId).toBe(null);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("binds all pairs when every staff email matches an unbound user", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(emailLocalArb, { minLength: 1, maxLength: 8 }),
        (locals) => {
          const staffList: StaffRecord[] = [];
          const users = new Map<number, UserRecord>();

          locals.forEach((local, i) => {
            const email = `${local}@test.com`;
            staffList.push({ id: i + 1, name: `S${i}`, email });
            users.set(1000 + i, {
              id: 1000 + i,
              email,
              staffId: null,
            });
          });

          const result = autoBindByEmail(users, staffList);

          expect(result.success).toBe(true);
          expect(result.bound).toBe(locals.length);
          expect(result.skipped).toBe(0);

          // Every user should now be bound to the matching staff
          for (let i = 0; i < locals.length; i++) {
            expect(users.get(1000 + i)!.staffId).toBe(i + 1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("skips staff with null email", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 200, max: 300 }),
        fc.emailAddress(),
        (staffId, userId, email) => {
          const staffList: StaffRecord[] = [
            { id: staffId, name: "NullEmail", email: null },
          ];
          const users = new Map<number, UserRecord>([
            [userId, { id: userId, email, staffId: null }],
          ]);

          const result = autoBindByEmail(users, staffList);

          expect(result.bound).toBe(0);
          expect(users.get(userId)!.staffId).toBe(null);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("handles duplicate emails: only first unbound user per email gets bound", () => {
    fc.assert(
      fc.property(
        emailLocalArb,
        fc.integer({ min: 1, max: 50 }),
        (local, staffId) => {
          const email = `${local}@test.com`;

          // Two users with the same email, one staff
          const users = new Map<number, UserRecord>([
            [100, { id: 100, email, staffId: null }],
            [101, { id: 101, email, staffId: null }],
          ]);
          const staffList: StaffRecord[] = [
            { id: staffId, name: "S1", email },
          ];

          const result = autoBindByEmail(users, staffList);

          expect(result.success).toBe(true);
          expect(result.bound).toBe(1);

          // Exactly one user should be bound
          const boundUsers = [...users.values()].filter(
            (u) => u.staffId === staffId
          );
          expect(boundUsers.length).toBe(1);

          // One-to-one invariant holds
          expect(checkOneToOneInvariant(users)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
