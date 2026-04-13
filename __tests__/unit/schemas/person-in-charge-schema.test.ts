import { describe, it, expect } from "vitest";
import { caseCreateSchema, caseUpdateSchema } from "@/app/_lib/schemas/case-schema";
import { contactCreateSchema } from "@/app/_lib/schemas/contact-schema";

/**
 * Validates that staffInChargeIds is correctly parsed from FormData string values
 * in both case and contact schemas (many-to-many staff assignment).
 */
describe("staffInChargeIds coercion in case and contact schemas", () => {
  describe("caseCreateSchema", () => {
    it("coerces a comma-separated string to an array of integers", () => {
      const result = caseCreateSchema.safeParse({
        clientId: 1,
        staffInChargeIds: "1,2,3",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staffInChargeIds).toEqual([1, 2, 3]);
      }
    });

    it("coerces a single numeric string to an array with one element", () => {
      const result = caseCreateSchema.safeParse({
        clientId: 1,
        staffInChargeIds: "42",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staffInChargeIds).toEqual([42]);
      }
    });

    it("coerces empty string to empty array", () => {
      const result = caseCreateSchema.safeParse({
        clientId: 1,
        staffInChargeIds: "",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staffInChargeIds).toEqual([]);
      }
    });

    it("accepts null as empty array", () => {
      const result = caseCreateSchema.safeParse({
        clientId: 1,
        staffInChargeIds: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staffInChargeIds).toEqual([]);
      }
    });

    it("accepts undefined as empty array", () => {
      const result = caseCreateSchema.safeParse({
        clientId: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staffInChargeIds).toEqual([]);
      }
    });

    it("accepts a direct array of integers", () => {
      const result = caseCreateSchema.safeParse({
        clientId: 1,
        staffInChargeIds: [7, 8],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staffInChargeIds).toEqual([7, 8]);
      }
    });

    it("filters out non-integer values from comma-separated string", () => {
      const result = caseCreateSchema.safeParse({
        clientId: 1,
        staffInChargeIds: "1,abc,3",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staffInChargeIds).toEqual([1, 3]);
      }
    });
  });

  describe("caseUpdateSchema", () => {
    it("coerces a comma-separated string to an array of integers", () => {
      const result = caseUpdateSchema.safeParse({
        staffInChargeIds: "10,20",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staffInChargeIds).toEqual([10, 20]);
      }
    });

    it("coerces empty string to empty array", () => {
      const result = caseUpdateSchema.safeParse({
        staffInChargeIds: "",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staffInChargeIds).toEqual([]);
      }
    });
  });

  describe("contactCreateSchema", () => {
    it("coerces a comma-separated string to an array of integers", () => {
      const result = contactCreateSchema.safeParse({
        clientId: 1,
        staffInChargeIds: "5,6",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staffInChargeIds).toEqual([5, 6]);
      }
    });

    it("coerces empty string to empty array", () => {
      const result = contactCreateSchema.safeParse({
        clientId: 1,
        staffInChargeIds: "",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staffInChargeIds).toEqual([]);
      }
    });

    it("accepts null as empty array", () => {
      const result = contactCreateSchema.safeParse({
        clientId: 1,
        staffInChargeIds: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.staffInChargeIds).toEqual([]);
      }
    });
  });
});
