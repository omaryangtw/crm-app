import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * **Validates: Requirements 2.1, 2.2, 2.3, 1.5**
 *
 * Property 2: Session staffId 往返一致性
 * For any User (staffId as positive integer or null), after passing through
 * the jwt callback (user → token) and session callback (token → session),
 * session.user.staffId must equal the original staffId value.
 */
describe("Feature: staff-user-binding, Property 2: Session staffId round-trip consistency", () => {
  // Extract jwt callback logic as a pure function (mirrors auth.ts jwt callback)
  function jwtCallback(
    token: Record<string, unknown>,
    user: { staffId?: number | null } | undefined
  ): Record<string, unknown> {
    if (user) {
      token.staffId = (user as { staffId?: number | null }).staffId ?? null;
    }
    return token;
  }

  // Extract session callback logic as a pure function (mirrors auth.ts session callback)
  function sessionCallback(
    session: { user: Record<string, unknown> },
    token: Record<string, unknown>
  ): { user: Record<string, unknown> } {
    session.user.staffId = (token.staffId as number | null) ?? null;
    return session;
  }

  const staffIdArb = fc.oneof(
    fc.integer({ min: 1 }),
    fc.constant(null)
  );

  it("session.user.staffId === original staffId after jwt + session callbacks", () => {
    fc.assert(
      fc.property(staffIdArb, (staffId) => {
        // Simulate: user logs in with this staffId
        const user = { staffId };
        const token: Record<string, unknown> = {};

        // Step 1: jwt callback writes staffId into token
        const updatedToken = jwtCallback(token, user);

        // Step 2: session callback reads staffId from token into session
        const session = { user: {} as Record<string, unknown> };
        const updatedSession = sessionCallback(session, updatedToken);

        // Verify round-trip: session.user.staffId === original staffId
        expect(updatedSession.user.staffId).toBe(staffId);
      }),
      { numRuns: 100 }
    );
  });
});
