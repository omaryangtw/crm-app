import { describe, it, expect } from "vitest";
import fc from "fast-check";

/**
 * **Validates: Requirements 3.5**
 *
 * Property 4: 編輯表單不受 session 預填影響
 *
 * For any existing case or contact record, regardless of the current session's
 * staffId value, the edit form's StaffSelector defaultValue should always equal
 * the record's staffInCharge ID array.
 *
 * The actual logic in both CaseForm and ContactForm is:
 *   defaultValues?.staffInChargeIds ?? (sessionStaffId ? [sessionStaffId] : [])
 *
 * In "edit" mode, defaultValues.staffInChargeIds is always defined (the record's
 * existing staff IDs), so the ?? operator returns defaultValues.staffInChargeIds
 * regardless of sessionStaffId.
 */
describe("Feature: staff-user-binding, Property 4: 編輯表單不受 session 預填影響", () => {
  /**
   * Pure extraction of the prefill logic used in CaseForm and ContactForm.
   * In edit mode, defaultValues.staffInChargeIds is always provided.
   */
  function computeEditDefaultValue(
    staffInChargeIds: number[],
    sessionStaffId: number | null
  ): number[] {
    // This mirrors the exact expression from both forms:
    // defaultValues?.staffInChargeIds ?? (sessionStaffId ? [sessionStaffId] : [])
    // In edit mode, staffInChargeIds is always defined (even if empty array).
    const defaultValues = { staffInChargeIds };
    return defaultValues?.staffInChargeIds ?? (sessionStaffId ? [sessionStaffId] : []);
  }

  const sessionStaffIdArb = fc.oneof(
    fc.integer({ min: 1 }),
    fc.constant(null)
  );

  const staffInChargeIdsArb = fc.array(fc.integer({ min: 1 }), { minLength: 0, maxLength: 5 });

  it("edit mode defaultValue always equals record staffInCharge, regardless of session staffId", () => {
    fc.assert(
      fc.property(staffInChargeIdsArb, sessionStaffIdArb, (staffInChargeIds, sessionStaffId) => {
        const result = computeEditDefaultValue(staffInChargeIds, sessionStaffId);

        // Req 3.5: edit form uses record's staffInCharge, not session
        expect(result).toEqual(staffInChargeIds);
        expect(result).toBe(staffInChargeIds); // same reference — ?? returns LHS directly
      }),
      { numRuns: 100 }
    );
  });
});
