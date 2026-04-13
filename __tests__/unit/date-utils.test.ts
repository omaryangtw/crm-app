import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeBirthdayFields } from "@/app/_lib/utils/date-utils";
import { differenceInYears, getYear, getMonth, getDate, getDayOfYear } from "date-fns";

/**
 * Property 4: Birthday field computation
 *
 * **Validates: Requirements 4.6**
 */
describe("Property 4: Birthday field computation", () => {
  it("should return all-null fields for null input", () => {
    const result = computeBirthdayFields(null);
    expect(result.age).toBeNull();
    expect(result.birthYear).toBeNull();
    expect(result.birthMonth).toBeNull();
    expect(result.birthDay).toBeNull();
    expect(result.birthDayOfYear).toBeNull();
  });

  it("should compute correct birthday fields for any valid date", () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date(1900, 0, 1),
          max: new Date(),
        }).filter((d) => !isNaN(d.getTime())),
        (birthday) => {
          const result = computeBirthdayFields(birthday);
          const now = new Date();

          // age equals differenceInYears from date-fns
          expect(result.age).toBe(differenceInYears(now, birthday));

          // birthYear equals the year component
          expect(result.birthYear).toBe(getYear(birthday));

          // birthMonth is 1-indexed (1-12)
          expect(result.birthMonth).toBe(getMonth(birthday) + 1);
          expect(result.birthMonth).toBeGreaterThanOrEqual(1);
          expect(result.birthMonth).toBeLessThanOrEqual(12);

          // birthDay is 1-indexed (1-31)
          expect(result.birthDay).toBe(getDate(birthday));
          expect(result.birthDay).toBeGreaterThanOrEqual(1);
          expect(result.birthDay).toBeLessThanOrEqual(31);

          // birthDayOfYear matches getDayOfYear
          expect(result.birthDayOfYear).toBe(getDayOfYear(birthday));
        }
      ),
      { numRuns: 100 }
    );
  });
});
