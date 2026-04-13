import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { clientCreateSchema } from "@/app/_lib/schemas/client-schema";
import { caseCreateSchema } from "@/app/_lib/schemas/case-schema";
import { contactCreateSchema } from "@/app/_lib/schemas/contact-schema";

/**
 * **Validates: Requirements 29.1, 29.3**
 *
 * Property 17: Zod schema validation
 * - Valid inputs conforming to all field types and enum constraints are accepted
 * - Inputs with invalid enum values are rejected with field-identifying errors
 */
describe("Feature: crm-modernization, Property 17: Zod schema validation", () => {
  // --- Enum value sets ---
  const validSex = ["male", "female"] as const;
  const validIncomeStatus = ["low", "mid_low", "mid_low_elderly"] as const;
  const validDisabledStatus = ["light", "mid", "heavy"] as const;
  const validIndigenousGroup = [
    "amis", "atayal", "bunun", "kanakanavu", "kavalan", "paiwan",
    "puyuma", "rukai", "hla_alua", "saisiyat", "sakizaya", "seediq",
    "truku", "thao", "tsou", "yami",
  ] as const;
  const validPlainMountain = ["plain", "mountain"] as const;
  const validCaseStatus = ["in_progress", "closed"] as const;
  const validContactType = ["outgoing", "incoming", "visit", "sms"] as const;

  // --- Generators ---
  const shortStr = (max: number) => fc.string({ minLength: 1, maxLength: max });

  const validClientArb = fc.record({
    name: shortStr(100),
    sex: fc.constantFrom(...validSex),
    indigenousGroup: fc.constantFrom(...validIndigenousGroup),
    incomeStatus: fc.constantFrom(...validIncomeStatus),
    disabledStatus: fc.constantFrom(...validDisabledStatus),
    plainMountain: fc.constantFrom(...validPlainMountain),
  });

  const validCaseArb = fc.record({
    status: fc.constantFrom(...validCaseStatus),
    clientId: fc.integer({ min: 1, max: 100000 }),
  });

  const validContactArb = fc.record({
    contactType: fc.constantFrom(...validContactType),
    clientId: fc.integer({ min: 1, max: 100000 }),
  });

  // Generator for strings guaranteed NOT in a given set
  const invalidEnum = (validValues: readonly string[]) =>
    fc.string({ minLength: 1, maxLength: 30 }).filter(
      (s) => !(validValues as readonly string[]).includes(s)
    );

  // ---- Client schema tests ----

  it("accepts valid client inputs with correct enum values", () => {
    fc.assert(
      fc.property(validClientArb, (input) => {
        const result = clientCreateSchema.safeParse(input);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects client inputs with invalid sex enum", () => {
    fc.assert(
      fc.property(invalidEnum(validSex), (badSex) => {
        const input = { name: "Test", sex: badSex };
        const result = clientCreateSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          const fieldNames = result.error.issues.map((i) => i.path[0]);
          expect(fieldNames).toContain("sex");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("rejects client inputs with invalid indigenousGroup enum", () => {
    fc.assert(
      fc.property(invalidEnum(validIndigenousGroup), (badGroup) => {
        const input = { name: "Test", indigenousGroup: badGroup };
        const result = clientCreateSchema.safeParse(input);
        expect(result.success).toBe(false);
        if (!result.success) {
          const fieldNames = result.error.issues.map((i) => i.path[0]);
          expect(fieldNames).toContain("indigenousGroup");
        }
      }),
      { numRuns: 100 }
    );
  });

  // ---- Case schema tests ----

  it("accepts valid case inputs with correct enum values", () => {
    fc.assert(
      fc.property(validCaseArb, (input) => {
        const result = caseCreateSchema.safeParse(input);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects case inputs with invalid status enum", () => {
    fc.assert(
      fc.property(
        invalidEnum(validCaseStatus),
        fc.integer({ min: 1, max: 100000 }),
        (badStatus, clientId) => {
          const input = { status: badStatus, clientId };
          const result = caseCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
          if (!result.success) {
            const fieldNames = result.error.issues.map((i) => i.path[0]);
            expect(fieldNames).toContain("status");
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // ---- Contact schema tests ----

  it("accepts valid contact inputs with correct enum values", () => {
    fc.assert(
      fc.property(validContactArb, (input) => {
        const result = contactCreateSchema.safeParse(input);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("rejects contact inputs with invalid contactType enum", () => {
    fc.assert(
      fc.property(
        invalidEnum(validContactType),
        fc.integer({ min: 1, max: 100000 }),
        (badType, clientId) => {
          const input = { contactType: badType, clientId };
          const result = contactCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
          if (!result.success) {
            const fieldNames = result.error.issues.map((i) => i.path[0]);
            expect(fieldNames).toContain("contactType");
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
