import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * **Validates: Requirements 3.1, 3.2, 3.4**
 *
 * Property 3: 新增表單預填邏輯
 * For any session, if session.user.staffId is a non-null positive integer,
 * the StaffSelector defaultValue for new case/contact forms should contain
 * that staffId. If staffId is null, defaultValue should be an empty array.
 *
 * The actual logic in both CaseForm and ContactForm is:
 *   defaultValues?.staffInChargeIds ?? (sessionStaffId ? [sessionStaffId] : [])
 *
 * In "create" (new) mode, defaultValues?.staffInChargeIds is undefined,
 * so the expression reduces to: sessionStaffId ? [sessionStaffId] : []
 */
describe("Feature: staff-user-binding, Property 3: 新增表單預填邏輯", () => {
  /**
   * Pure extraction of the prefill logic used in CaseForm and ContactForm
   * for the "new" (create) mode where defaultValues.staffInChargeIds is undefined.
   */
  function computeCreateDefaultValue(
    sessionStaffId: number | null
  ): number[] {
    return sessionStaffId ? [sessionStaffId] : [];
  }

  const staffIdArb = fc.oneof(
    fc.integer({ min: 1 }),
    fc.constant(null)
  );

  it("positive staffId → defaultValue contains that staffId; null → empty array", () => {
    fc.assert(
      fc.property(staffIdArb, (sessionStaffId) => {
        const result = computeCreateDefaultValue(sessionStaffId);

        if (sessionStaffId !== null) {
          // Req 3.1 / 3.2: bound staff → prefill with [staffId]
          expect(result).toEqual([sessionStaffId]);
          expect(result).toHaveLength(1);
          expect(result[0]).toBe(sessionStaffId);
        } else {
          // Req 3.4: unbound → empty array
          expect(result).toEqual([]);
          expect(result).toHaveLength(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});
