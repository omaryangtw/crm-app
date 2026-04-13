import { describe, it, expect } from "vitest";
import fc from "fast-check";
import bcrypt from "bcrypt";

/**
 * **Validates: Requirements 1.1**
 *
 * Property 1: Registration password hashing
 * - For any valid 8-16 alphanumeric password, bcrypt.hash produces a hash !== plaintext
 * - For any valid password, bcrypt.compare(password, hash) returns true
 */
describe("Feature: crm-modernization, Property 1: Registration password hashing", () => {
  // Use lower salt rounds (4) for test performance — bcrypt behavior is identical,
  // only computational cost differs. Production uses 10.
  const SALT_ROUNDS = 4;

  it("stored hash !== plaintext AND bcrypt.compare returns true for any valid password", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-zA-Z0-9]{8,16}$/),
        async (password) => {
          const hash = await bcrypt.hash(password, SALT_ROUNDS);
          expect(hash).not.toBe(password);
          const isValid = await bcrypt.compare(password, hash);
          expect(isValid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  }, 60_000);
});
