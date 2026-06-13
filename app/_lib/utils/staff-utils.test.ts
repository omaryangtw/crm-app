import { describe, it, expect } from "vitest";
import { filterStaff, getActiveOnly, type StaffRecord } from "./staff-utils";

const staff: StaffRecord[] = [
  { id: 1, name: "Alice Wang", aliases: ["Malo"], email: "alice@example.com", phone: "0912345678", isActive: true },
  { id: 2, name: "Bob Chen", aliases: [], email: "bob@example.com", phone: null, isActive: false },
  { id: 3, name: "Charlie Li", aliases: ["Fox", "小李"], email: null, phone: "0987654321", isActive: true },
];

describe("filterStaff", () => {
  it("returns full list when search term is empty", () => {
    expect(filterStaff(staff, "")).toEqual(staff);
    expect(filterStaff(staff, "   ")).toEqual(staff);
  });

  it("matches name case-insensitively", () => {
    expect(filterStaff(staff, "alice")).toEqual([staff[0]]);
    expect(filterStaff(staff, "ALICE")).toEqual([staff[0]]);
  });

  it("matches email case-insensitively", () => {
    expect(filterStaff(staff, "bob@")).toEqual([staff[1]]);
  });

  it("matches phone", () => {
    expect(filterStaff(staff, "0987")).toEqual([staff[2]]);
  });

  it("matches aliases case-insensitively", () => {
    expect(filterStaff(staff, "malo")).toEqual([staff[0]]);
    expect(filterStaff(staff, "Fox")).toEqual([staff[2]]);
    expect(filterStaff(staff, "小李")).toEqual([staff[2]]);
  });

  it("returns empty array when nothing matches", () => {
    expect(filterStaff(staff, "zzz")).toEqual([]);
  });

  it("handles empty staff list", () => {
    expect(filterStaff([], "alice")).toEqual([]);
  });
});

describe("getActiveOnly", () => {
  it("returns only active records", () => {
    expect(getActiveOnly(staff)).toEqual([staff[0], staff[2]]);
  });

  it("returns empty array when all inactive", () => {
    const inactive = staff.map((s) => ({ ...s, isActive: false }));
    expect(getActiveOnly(inactive)).toEqual([]);
  });

  it("returns all when all active", () => {
    const active = staff.map((s) => ({ ...s, isActive: true }));
    expect(getActiveOnly(active)).toEqual(active);
  });

  it("handles empty list", () => {
    expect(getActiveOnly([])).toEqual([]);
  });
});
