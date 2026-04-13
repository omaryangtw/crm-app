import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { registerSchema } from "@/app/_lib/schemas/auth-schema";

/**
 * **Validates: Requirements 1.3, 1.4**
 *
 * Property 2: Auth input validation
 * - Valid emails + valid 8-16 alphanumeric passwords are accepted
 * - Invalid emails are rejected
 * - Passwords shorter than 8, longer than 16, or with non-alphanumeric chars are rejected
 */
describe("Feature: crm-modernization, Property 2: Auth input validation", () => {
  // Generate emails that Zod's .email() validator accepts (simple local@domain.tld)
  const zodSafeEmail = fc
    .tuple(
      fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{0,9}$/),
      fc.stringMatching(/^[a-zA-Z][a-zA-Z0-9]{1,9}$/),
      fc.constantFrom("com", "org", "net", "io", "tw")
    )
    .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

  it("accepts valid emails with valid 8-16 alphanumeric passwords", () => {
    fc.assert(
      fc.property(
        zodSafeEmail,
        fc.stringMatching(/^[a-zA-Z0-9]{8,16}$/),
        (email, password) => {
          const result = registerSchema.safeParse({ email, password });
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects invalid emails", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => {
          // Filter to strings that are clearly not valid emails
          return !s.includes("@") || s.startsWith("@") || s.endsWith("@") || s.includes(" ");
        }),
        fc.stringMatching(/^[a-zA-Z0-9]{8,16}$/),
        (email, password) => {
          const result = registerSchema.safeParse({ email, password });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects passwords shorter than 8 characters", () => {
    fc.assert(
      fc.property(
        fc.emailAddress(),
        fc.stringMatching(/^[a-zA-Z0-9]{1,7}$/),
        (email, password) => {
          const result = registerSchema.safeParse({ email, password });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects passwords longer than 16 characters", () => {
    fc.assert(
      fc.property(
        fc.emailAddress(),
        fc.stringMatching(/^[a-zA-Z0-9]{17,30}$/),
        (email, password) => {
          const result = registerSchema.safeParse({ email, password });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("rejects passwords with non-alphanumeric characters", () => {
    fc.assert(
      fc.property(
        fc.emailAddress(),
        fc.string({ minLength: 8, maxLength: 16 }).filter((s) => {
          // Must have at least one non-alphanumeric char
          return s.length >= 8 && s.length <= 16 && /[^a-zA-Z0-9]/.test(s);
        }),
        (email, password) => {
          const result = registerSchema.safeParse({ email, password });
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
