import { describe, it, expect } from "vitest";
import { computeBirthdayFields } from "./date-utils";
import { differenceInYears, getYear, getMonth, getDate, getDayOfYear } from "date-fns";

describe("computeBirthdayFields", () => {
  it("returns all null fields for null input", () => {
    const result = computeBirthdayFields(null);
    expect(result).toEqual({
      age: null,
      birthYear: null,
      birthMonth: null,
      birthDay: null,
      birthDayOfYear: null,
    });
  });

  it("computes correct fields for a known date", () => {
    const birthday = new Date(1990, 5, 15); // June 15, 1990
    const result = computeBirthdayFields(birthday);

    expect(result.birthYear).toBe(1990);
    expect(result.birthMonth).toBe(6); // 1-indexed
    expect(result.birthDay).toBe(15);
    expect(result.age).toBe(differenceInYears(new Date(), birthday));
    expect(result.birthDayOfYear).toBe(getDayOfYear(birthday));
  });

  it("computes correct fields for Jan 1", () => {
    const birthday = new Date(2000, 0, 1); // Jan 1, 2000
    const result = computeBirthdayFields(birthday);

    expect(result.birthYear).toBe(2000);
    expect(result.birthMonth).toBe(1);
    expect(result.birthDay).toBe(1);
    expect(result.birthDayOfYear).toBe(1);
  });

  it("computes correct fields for Dec 31", () => {
    const birthday = new Date(1985, 11, 31); // Dec 31, 1985
    const result = computeBirthdayFields(birthday);

    expect(result.birthYear).toBe(1985);
    expect(result.birthMonth).toBe(12);
    expect(result.birthDay).toBe(31);
    expect(result.birthDayOfYear).toBe(getDayOfYear(birthday));
  });
});
