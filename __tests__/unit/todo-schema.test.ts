import { describe, it, expect } from "vitest";
import { todoCreateSchema, todoUpdateSchema } from "@/app/_lib/schemas/todo-schema";
import { coerceStaffInChargeIds } from "@/app/_lib/schemas/contact-schema";

describe("Todo Zod schemas unit tests", () => {
  /**
   * **Validates: Requirements 8.1**
   * todoCreateSchema accepts a complete valid input
   */
  it("todoCreateSchema accepts valid input with all fields", () => {
    const result = todoCreateSchema.safeParse({
      date: "2024-01-01",
      note: "test",
      clientId: 1,
      staffInChargeIds: "1,2",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.clientId).toBe(1);
      expect(result.data.staffInChargeIds).toEqual([1, 2]);
    }
  });

  /**
   * **Validates: Requirements 8.2**
   * todoUpdateSchema accepts empty object (all fields optional)
   */
  it("todoUpdateSchema accepts empty object — all fields optional", () => {
    const result = todoUpdateSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  /**
   * **Validates: Requirements 8.4**
   * coerceStaffInChargeIds coerces empty string to empty array
   */
  it('coerceStaffInChargeIds parses "" to []', () => {
    const result = coerceStaffInChargeIds.parse("");
    expect(result).toEqual([]);
  });

  /**
   * **Validates: Requirements 8.4**
   * coerceStaffInChargeIds coerces null to empty array
   */
  it("coerceStaffInChargeIds parses null to []", () => {
    const result = coerceStaffInChargeIds.parse(null);
    expect(result).toEqual([]);
  });

  /**
   * **Validates: Requirements 8.4**
   * coerceStaffInChargeIds coerces undefined to empty array
   */
  it("coerceStaffInChargeIds parses undefined to []", () => {
    const result = coerceStaffInChargeIds.parse(undefined);
    expect(result).toEqual([]);
  });
});
