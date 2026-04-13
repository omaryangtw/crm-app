import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { formatCompletionMessage } from "@/app/_lib/utils/todo-utils";

/**
 * **Validates: Requirements 19.4**
 *
 * Property 14: Todo completion contact format
 * Tests that the auto-created contact record field matches
 * "{D} 系統訊息({E}):完成 {N}" format for any date/email/note.
 */
describe("Feature: crm-modernization, Property 14: Todo completion contact format", () => {
  const dateArb = fc.date({ min: new Date("2000-01-01"), max: new Date("2099-12-31") }).map(
    (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  );
  const emailArb = fc.emailAddress();
  const noteArb = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

  it("output matches the expected pattern for any date/email/note", () => {
    fc.assert(
      fc.property(dateArb, emailArb, noteArb, (date, email, note) => {
        const result = formatCompletionMessage(date, email, note);

        // Must match the exact format: "{date} 系統訊息({email}):完成 {note}"
        const expected = `${date} 系統訊息(${email}):完成 ${note}`;
        expect(result).toBe(expected);

        // Verify structural properties
        expect(result).toContain("系統訊息(");
        expect(result).toContain("):完成 ");
        expect(result.startsWith(date)).toBe(true);
        expect(result.endsWith(note)).toBe(true);
        expect(result).toContain(email);
      }),
      { numRuns: 100 }
    );
  });

  it("output contains all three input components without loss", () => {
    fc.assert(
      fc.property(dateArb, emailArb, noteArb, (date, email, note) => {
        const result = formatCompletionMessage(date, email, note);

        // All inputs must appear in the output
        expect(result).toContain(date);
        expect(result).toContain(email);
        expect(result).toContain(note);
      }),
      { numRuns: 100 }
    );
  });
});
