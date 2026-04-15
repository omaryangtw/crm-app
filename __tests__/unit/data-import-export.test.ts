/**
 * Property-based tests for data-import-export pure functions.
 *
 * Uses fast-check v4.6.0 + vitest. Each property runs ≥100 iterations.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  validateEnum,
  emptyToNull,
  parseDate,
  toBool,
  mapClientRecord,
  mapCaseRecord,
  mapContactRecord,
  mapFamilyRecord,
  parseJsonPayload,
  VALID_GROUPS,
  VALID_PLAIN_MOUNTAIN,
  VALID_INCOME_STATUS,
  VALID_DISABLED_STATUS,
  VALID_CASE_STATUS,
  VALID_CASE_TYPE_MAJOR,
  VALID_CASE_TYPE_MINOR,
  VALID_CONTACT_TYPE,
} from "@/app/_lib/utils/import-utils";
import { RELATIONSHIP_INVERSE_MAP } from "@/app/_lib/constants/relationship-map";

// ── Shared generators ──

const allEnumSets: Set<string>[] = [
  VALID_GROUPS,
  VALID_PLAIN_MOUNTAIN,
  VALID_INCOME_STATUS,
  VALID_DISABLED_STATUS,
  VALID_CASE_STATUS,
  VALID_CASE_TYPE_MAJOR,
  VALID_CASE_TYPE_MINOR,
  VALID_CONTACT_TYPE,
];

/** Pick a random enum set, then a random valid value from it */
const arbEnumSetAndValue = fc
  .constantFrom(...allEnumSets)
  .chain((set) => {
    const values = [...set];
    return fc.tuple(fc.constant(set), fc.constantFrom(...values));
  });

/** Pick a random enum set, then a string NOT in that set */
const arbEnumSetAndInvalid = fc
  .constantFrom(...allEnumSets)
  .chain((set) =>
    fc.tuple(
      fc.constant(set),
      fc.string({ minLength: 1 }).filter((s) => s.trim() !== "" && !set.has(s.trim())),
    ),
  );

const arbNullish = fc.constantFrom(null, undefined, "", " ", "  ");

// ── Custom record generators ──

const arbOptString = fc.oneof(fc.string({ minLength: 1, maxLength: 30 }), fc.constant(null), fc.constant(undefined), fc.constant(""));
const arbOptBool = fc.oneof(fc.boolean(), fc.constant(null), fc.constant(undefined), fc.constant(""));

// Use integer timestamps to avoid invalid date edge cases in fc.date()
const safeDateStr = fc.integer({
  min: new Date("1920-01-01").getTime(),
  max: new Date("2024-01-01").getTime(),
}).map((ts) => new Date(ts).toISOString());

const arbLegacyClient = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  name: arbOptString,
  nameAlt: arbOptString,
  IDN: arbOptString,
  sex: fc.constantFrom("male", "female", null),
  birthday: fc.oneof(
    safeDateStr,
    fc.constant(null),
    fc.constant("not-a-date"),
  ),
  isDead: arbOptBool,
  householdadmin: arbOptBool,
  incomeStatus: fc.oneof(fc.constantFrom(...VALID_INCOME_STATUS), fc.constant(null), fc.constant("invalid")),
  disabledStatus: fc.oneof(fc.constantFrom(...VALID_DISABLED_STATUS), fc.constant(null), fc.constant("invalid")),
  group: fc.oneof(fc.constantFrom(...VALID_GROUPS), fc.constant(null), fc.constant("不明族")),
  tribe: arbOptString,
  plainMountain: fc.oneof(fc.constantFrom(...VALID_PLAIN_MOUNTAIN), fc.constant(null), fc.constant("invalid")),
  canCall: arbOptBool,
  phone: arbOptString,
  phoneNote: arbOptString,
  phoneAlt: arbOptString,
  phoneAltNote: arbOptString,
  mobile: arbOptString,
  mobileNote: arbOptString,
  mobileAlt: arbOptString,
  mobileAltNote: arbOptString,
  canMail: arbOptBool,
  city: arbOptString,
  cityAlt: arbOptString,
  dist: arbOptString,
  distAlt: arbOptString,
  vill: arbOptString,
  villAlt: arbOptString,
  addr: arbOptString,
  addrAlt: arbOptString,
  addrNote: arbOptString,
  addrAltNote: arbOptString,
  note: arbOptString,
  createdAt: fc.oneof(safeDateStr, fc.constant(null)),
  updatedAt: fc.oneof(safeDateStr, fc.constant(null)),
});

const arbLegacyCase = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  ClientId: fc.integer({ min: 1, max: 10000 }),
  name: arbOptString,
  status: fc.oneof(fc.constantFrom(...VALID_CASE_STATUS), fc.constant(null), fc.constant("invalid")),
  typesMajor: fc.oneof(fc.constantFrom(...VALID_CASE_TYPE_MAJOR), fc.constant(null), fc.constant("invalid")),
  typesMinor: fc.oneof(fc.constantFrom(...VALID_CASE_TYPE_MINOR), fc.constant(null), fc.constant("invalid")),
  personInCharge: arbOptString,
  relation1: arbOptString,
  relation2: arbOptString,
  relation3: arbOptString,
  contact1: arbOptString,
  contact2: arbOptString,
  contact3: arbOptString,
  note: arbOptString,
  handle: arbOptString,
  createdAt: fc.oneof(safeDateStr, fc.constant(null)),
  updatedAt: fc.oneof(safeDateStr, fc.constant(null)),
});

const arbLegacyContact = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  ClientId: fc.integer({ min: 1, max: 10000 }),
  date: fc.oneof(safeDateStr, fc.constant(null)),
  contactType: fc.oneof(fc.constantFrom(...VALID_CONTACT_TYPE), fc.constant(null), fc.constant("invalid")),
  isSuccess: fc.oneof(fc.boolean(), fc.constant(null), fc.constant(undefined)),
  record: arbOptString,
  personInCharge: arbOptString,
  createdAt: fc.oneof(safeDateStr, fc.constant(null)),
  updatedAt: fc.oneof(safeDateStr, fc.constant(null)),
});

const validRelationships = Object.keys(RELATIONSHIP_INVERSE_MAP);

const arbLegacyFamily = fc.record({
  ClientId: fc.integer({ min: 1, max: 10000 }),
  FamilyId: fc.integer({ min: 1, max: 10000 }),
  relationship: fc.constantFrom(...validRelationships),
});

/** Generate a Map<number, string> for client sex lookup */
const arbSexMap = (clientId: number) =>
  fc.constantFrom("male", "female").map(
    (sex) => new Map<number, string>([[clientId, sex]]),
  );


// ════════════════════════════════════════════════════════════════════
// Property 1: validateEnum 接受合法值、拒絕非法值
// ════════════════════════════════════════════════════════════════════

describe("Feature: data-import-export, Property 1: validateEnum 接受合法值、拒絕非法值", () => {
  /**
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**
   */

  it("returns the original value for any valid member of the set", () => {
    fc.assert(
      fc.property(arbEnumSetAndValue, ([set, value]) => {
        expect(validateEnum(value, set)).toBe(value);
      }),
      { numRuns: 100 },
    );
  });

  it("returns null for any string not in the set", () => {
    fc.assert(
      fc.property(arbEnumSetAndInvalid, ([set, value]) => {
        expect(validateEnum(value, set)).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("returns null for null, undefined, empty, or whitespace-only strings", () => {
    fc.assert(
      fc.property(arbNullish, fc.constantFrom(...allEnumSets), (value, set) => {
        expect(validateEnum(value as string | null | undefined, set)).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// Property 2: emptyToNull 空值轉換
// ════════════════════════════════════════════════════════════════════

describe("Feature: data-import-export, Property 2: emptyToNull 空值轉換", () => {
  /**
   * **Validates: Requirements 2.5**
   */

  it("returns trimmed string for non-empty strings", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        (value) => {
          const result = emptyToNull(value);
          expect(result).toBe(value.trim());
          expect(result).not.toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns null for null, undefined, empty, or whitespace-only values", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, "", " ", "   ", "\t", "\n"),
        (value) => {
          expect(emptyToNull(value as string | null | undefined)).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// Property 3: parseDate 日期解析
// ════════════════════════════════════════════════════════════════════

describe("Feature: data-import-export, Property 3: parseDate 日期解析", () => {
  /**
   * **Validates: Requirements 2.6**
   */

  it("returns a valid Date for ISO date strings", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("1900-01-01"), max: new Date("2100-01-01") }),
        (date) => {
          const isoStr = date.toISOString();
          const result = parseDate(isoStr);
          expect(result).toBeInstanceOf(Date);
          expect(result!.getTime()).toBe(date.getTime());
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns null for non-date strings", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => isNaN(new Date(s).getTime())),
        (value) => {
          expect(parseDate(value)).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns null for null and undefined", () => {
    expect(parseDate(null)).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });

  it("never throws for any string input", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        expect(() => parseDate(value)).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// Property 4: toBool 布林轉換
// ════════════════════════════════════════════════════════════════════

describe("Feature: data-import-export, Property 4: toBool 布林轉換", () => {
  /**
   * **Validates: Requirements 2.7**
   */

  it("returns the boolean value for boolean inputs", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (value, defaultVal) => {
        expect(toBool(value, defaultVal)).toBe(value);
      }),
      { numRuns: 100 },
    );
  });

  it("returns default for null, undefined, or empty string", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(null, undefined, ""),
        fc.boolean(),
        (value, defaultVal) => {
          expect(toBool(value, defaultVal)).toBe(defaultVal);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("is idempotent: toBool(toBool(x, d), d) === toBool(x, d)", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.boolean(), fc.constantFrom(null, undefined, ""), fc.string()),
        fc.boolean(),
        (value, defaultVal) => {
          const first = toBool(value, defaultVal);
          const second = toBool(first, defaultVal);
          expect(second).toBe(first);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ════════════════════════════════════════════════════════════════════
// Property 5: Client 欄位對應與 seed.ts 一致性
// ════════════════════════════════════════════════════════════════════

describe("Feature: data-import-export, Property 5: Client 欄位對應與 seed.ts 一致性", () => {
  /**
   * **Validates: Requirements 2.1, 9.1, 9.3**
   */

  it("maps legacy client fields to correct DB field names and values", () => {
    fc.assert(
      fc.property(arbLegacyClient, (raw) => {
        const { data } = mapClientRecord(raw as Record<string, unknown>, 1);

        // Key field name mappings
        expect(data.id).toBe(raw.id);
        expect(data.idn).toBe(emptyToNull(raw.IDN as string | null | undefined));
        expect(data.indigenous_group).toBe(validateEnum(raw.group as string | null | undefined, VALID_GROUPS));
        expect(data.household_admin).toBe(toBool(raw.householdadmin, false));
        expect(data.name_alt).toBe(emptyToNull(raw.nameAlt as string | null | undefined));
        expect(data.plain_mountain).toBe(validateEnum(raw.plainMountain as string | null | undefined, VALID_PLAIN_MOUNTAIN));
        expect(data.income_status).toBe(validateEnum(raw.incomeStatus as string | null | undefined, VALID_INCOME_STATUS));
        expect(data.disabled_status).toBe(validateEnum(raw.disabledStatus as string | null | undefined, VALID_DISABLED_STATUS));

        // Boolean fields with correct defaults
        expect(data.is_dead).toBe(toBool(raw.isDead, false));
        expect(data.can_call).toBe(toBool(raw.canCall, true));
        expect(data.can_mail).toBe(toBool(raw.canMail, true));

        // emptyToNull fields
        expect(data.name).toBe(emptyToNull(raw.name as string | null | undefined));
        expect(data.phone).toBe(emptyToNull(raw.phone as string | null | undefined));
        expect(data.mobile).toBe(emptyToNull(raw.mobile as string | null | undefined));
        expect(data.city).toBe(emptyToNull(raw.city as string | null | undefined));
        expect(data.note).toBe(emptyToNull(raw.note as string | null | undefined));

        // Date fields: parseDate or fallback to Date
        if (raw.birthday) {
          const parsed = parseDate(raw.birthday as string);
          if (parsed) {
            expect((data.birthday as Date).getTime()).toBe(parsed.getTime());
          } else {
            expect(data.birthday).toBeNull();
          }
        }

        // created_at / updated_at always produce a Date
        expect(data.created_at).toBeInstanceOf(Date);
        expect(data.updated_at).toBeInstanceOf(Date);

        // Verify no legacy field names leak into output
        expect(data).not.toHaveProperty("IDN");
        expect(data).not.toHaveProperty("nameAlt");
        expect(data).not.toHaveProperty("group");
        expect(data).not.toHaveProperty("householdadmin");
        expect(data).not.toHaveProperty("householdAdmin");
        expect(data).not.toHaveProperty("plainMountain");
      }),
      { numRuns: 100 },
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// Property 6: Case 欄位對應一致性
// ════════════════════════════════════════════════════════════════════

describe("Feature: data-import-export, Property 6: Case 欄位對應一致性", () => {
  /**
   * **Validates: Requirements 2.2**
   */

  it("maps legacy case fields to correct DB field names and values", () => {
    fc.assert(
      fc.property(arbLegacyCase, (raw) => {
        const { data } = mapCaseRecord(raw as Record<string, unknown>, 1);

        // Key field name mappings
        expect(data.id).toBe(raw.id);
        expect(data.client_id).toBe(raw.ClientId);
        expect(data.person_in_charge_legacy).toBe(emptyToNull(raw.personInCharge as string | null | undefined));
        expect(data.types_major).toBe(validateEnum(raw.typesMajor as string | null | undefined, VALID_CASE_TYPE_MAJOR));
        expect(data.types_minor).toBe(validateEnum(raw.typesMinor as string | null | undefined, VALID_CASE_TYPE_MINOR));
        expect(data.status).toBe(validateEnum(raw.status as string | null | undefined, VALID_CASE_STATUS));

        // emptyToNull fields
        expect(data.name).toBe(emptyToNull(raw.name as string | null | undefined));
        expect(data.note).toBe(emptyToNull(raw.note as string | null | undefined));
        expect(data.handle).toBe(emptyToNull(raw.handle as string | null | undefined));
        expect(data.relation1).toBe(emptyToNull(raw.relation1 as string | null | undefined));
        expect(data.contact1).toBe(emptyToNull(raw.contact1 as string | null | undefined));

        // Timestamps always produce a Date
        expect(data.created_at).toBeInstanceOf(Date);
        expect(data.updated_at).toBeInstanceOf(Date);

        // No legacy field names in output
        expect(data).not.toHaveProperty("ClientId");
        expect(data).not.toHaveProperty("personInCharge");
        expect(data).not.toHaveProperty("typesMajor");
        expect(data).not.toHaveProperty("typesMinor");
      }),
      { numRuns: 100 },
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// Property 7: Contact 欄位對應一致性
// ════════════════════════════════════════════════════════════════════

describe("Feature: data-import-export, Property 7: Contact 欄位對應一致性", () => {
  /**
   * **Validates: Requirements 2.3**
   */

  it("maps legacy contact fields to correct DB field names and values", () => {
    fc.assert(
      fc.property(arbLegacyContact, (raw) => {
        const { data } = mapContactRecord(raw as Record<string, unknown>, 1);

        // Key field name mappings
        expect(data.id).toBe(raw.id);
        expect(data.client_id).toBe(raw.ClientId);
        expect(data.contact_type).toBe(validateEnum(raw.contactType as string | null | undefined, VALID_CONTACT_TYPE));
        expect(data.person_in_charge_legacy).toBe(emptyToNull(raw.personInCharge as string | null | undefined));

        // is_success: uses nullish coalescing (raw.isSuccess ?? true)
        const expectedIsSuccess = (raw.isSuccess as boolean | null | undefined) ?? true;
        expect(data.is_success).toBe(expectedIsSuccess);

        // emptyToNull fields
        expect(data.record).toBe(emptyToNull(raw.record as string | null | undefined));

        // Timestamps always produce a Date
        expect(data.created_at).toBeInstanceOf(Date);
        expect(data.updated_at).toBeInstanceOf(Date);

        // No legacy field names in output
        expect(data).not.toHaveProperty("ClientId");
        expect(data).not.toHaveProperty("contactType");
        expect(data).not.toHaveProperty("isSuccess");
        expect(data).not.toHaveProperty("personInCharge");
      }),
      { numRuns: 100 },
    );
  });
});


// ════════════════════════════════════════════════════════════════════
// Property 8: Family 欄位對應與反向關係計算
// ════════════════════════════════════════════════════════════════════

describe("Feature: data-import-export, Property 8: Family 欄位對應與反向關係計算", () => {
  /**
   * **Validates: Requirements 2.4**
   */

  it("maps legacy family fields and computes inverse relationship correctly", () => {
    fc.assert(
      fc.property(
        arbLegacyFamily.chain((family) =>
          arbSexMap(family.ClientId).map((sexMap) => ({ family, sexMap })),
        ),
        ({ family, sexMap }) => {
          const raw = family as Record<string, unknown>;
          const { data } = mapFamilyRecord(raw, 1, sexMap);

          // Key field name mappings
          expect(data.person_a_id).toBe(family.ClientId);
          expect(data.person_b_id).toBe(family.FamilyId);
          expect(data.relation_a_to_b).toBe(family.relationship);

          // Inverse relationship calculation
          const sourceSex = sexMap.get(family.ClientId)!;
          const expectedInverse =
            RELATIONSHIP_INVERSE_MAP[family.relationship]?.[sourceSex] ?? family.relationship;
          expect(data.relation_b_to_a).toBe(expectedInverse);

          // No legacy field names in output
          expect(data).not.toHaveProperty("ClientId");
          expect(data).not.toHaveProperty("FamilyId");
          expect(data).not.toHaveProperty("relationship");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("falls back to original relationship when sex is unknown", () => {
    fc.assert(
      fc.property(arbLegacyFamily, (family) => {
        const emptySexMap = new Map<number, string>();
        const raw = family as Record<string, unknown>;
        const { data } = mapFamilyRecord(raw, 1, emptySexMap);

        // Without sex info, inverse falls back to original relationship
        expect(data.relation_b_to_a).toBe(family.relationship);
      }),
      { numRuns: 100 },
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// Property 9: JSON payload 驗證
// ════════════════════════════════════════════════════════════════════

describe("Feature: data-import-export, Property 9: JSON payload 驗證", () => {
  /**
   * **Validates: Requirements 1.3, 1.4, 1.5, 1.6**
   */

  it("returns success with records for valid non-empty JSON arrays", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.jsonValue()),
          { minLength: 1, maxLength: 10 },
        ),
        (records) => {
          const text = JSON.stringify(records);
          const result = parseJsonPayload(text);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.records).toHaveLength(records.length);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns error for invalid JSON strings", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => {
          try { JSON.parse(s); return false; } catch { return true; }
        }),
        (text) => {
          const result = parseJsonPayload(text);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toBe("檔案格式錯誤：無法解析 JSON");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns error for non-array JSON (objects, strings, numbers, booleans, null)", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.dictionary(fc.string({ minLength: 1, maxLength: 5 }), fc.jsonValue()).map((o) => JSON.stringify(o)),
          fc.double({ noNaN: true }).map((n) => JSON.stringify(n)),
          fc.string().map((s) => JSON.stringify(s)),
          fc.boolean().map((b) => JSON.stringify(b)),
          fc.constant("null"),
        ),
        (text) => {
          const result = parseJsonPayload(text);
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toBe("檔案內容必須為 JSON 陣列");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns error for empty JSON arrays", () => {
    const result = parseJsonPayload("[]");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("檔案不包含任何記錄");
    }
  });
});


// ════════════════════════════════════════════════════════════════════
// Integration Tests: Import Server Actions
// ════════════════════════════════════════════════════════════════════

import { vi, beforeEach } from "vitest";

/**
 * Integration tests for import server actions.
 * These mock prisma, auth, and audit-service to test the full import flow
 * without a real database.
 *
 * **Validates: Requirements 4.3, 4.4, 4.6, 6.1, 6.2**
 */

// ── Helpers ──

function makeFormData(
  records: Record<string, unknown>[],
  conflictStrategy: "skip" | "overwrite" = "skip",
  fileName = "test.json",
): FormData {
  const json = JSON.stringify(records);
  const file = new File([json], fileName, { type: "application/json" });
  const fd = new FormData();
  fd.set("file", file);
  fd.set("conflictStrategy", conflictStrategy);
  return fd;
}

describe("Integration: importClients skip strategy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("skips existing records and reports correct skipped count", async () => {
    const mockExecuteRawUnsafe = vi.fn()
      // First record: ON CONFLICT DO NOTHING returns 0 (skipped)
      .mockResolvedValueOnce(0)
      // Sequence reset
      .mockResolvedValueOnce(undefined);

    const mockCreateAuditLogEntry = vi.fn().mockResolvedValue(undefined);

    vi.doMock("@/app/_lib/db", () => ({
      prisma: {
        $executeRawUnsafe: mockExecuteRawUnsafe,
      },
    }));

    vi.doMock("@/app/_lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: { id: "1", email: "admin@test.com", role: "admin" },
      }),
    }));

    vi.doMock("@/app/_lib/audit/audit-service", () => ({
      createAuditLogEntry: mockCreateAuditLogEntry,
    }));

    const { importClients } = await import(
      "@/app/_lib/actions/import-actions"
    );

    const fd = makeFormData([
      { id: 1, name: "已存在的族人", IDN: "A123456789" },
    ], "skip");

    const result = await importClients(fd);

    expect(result.success).toBe(true);
    expect(result.table).toBe("clients");
    expect(result.total).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.inserted).toBe(0);
    expect(result.overwritten).toBe(0);
  });
});

describe("Integration: importClients overwrite strategy", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("overwrites existing records and reports correct overwritten count", async () => {
    const mockExecuteRawUnsafe = vi.fn()
      // First record: ON CONFLICT DO UPDATE returns 1 (upserted)
      .mockResolvedValueOnce(1)
      // Sequence reset
      .mockResolvedValueOnce(undefined);

    const mockCreateAuditLogEntry = vi.fn().mockResolvedValue(undefined);

    vi.doMock("@/app/_lib/db", () => ({
      prisma: {
        $executeRawUnsafe: mockExecuteRawUnsafe,
      },
    }));

    vi.doMock("@/app/_lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: { id: "1", email: "admin@test.com", role: "admin" },
      }),
    }));

    vi.doMock("@/app/_lib/audit/audit-service", () => ({
      createAuditLogEntry: mockCreateAuditLogEntry,
    }));

    const { importClients } = await import(
      "@/app/_lib/actions/import-actions"
    );

    const fd = makeFormData([
      { id: 1, name: "覆蓋的族人", IDN: "B987654321" },
    ], "overwrite");

    const result = await importClients(fd);

    expect(result.success).toBe(true);
    expect(result.table).toBe("clients");
    expect(result.total).toBe(1);
    expect(result.overwritten).toBe(1);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(0);
  });
});

describe("Integration: importCases referential integrity", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("skips case when client_id does not exist and records ValidationError", async () => {
    const mockExecuteRawUnsafe = vi.fn()
      // First record: FK violation from DB
      .mockRejectedValueOnce(new Error('insert or update on table "cases" violates foreign key constraint'))
      // Sequence reset
      .mockResolvedValueOnce(undefined);

    const mockCreateAuditLogEntry = vi.fn().mockResolvedValue(undefined);

    vi.doMock("@/app/_lib/db", () => ({
      prisma: {
        $executeRawUnsafe: mockExecuteRawUnsafe,
      },
    }));

    vi.doMock("@/app/_lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: { id: "1", email: "admin@test.com", role: "admin" },
      }),
    }));

    vi.doMock("@/app/_lib/audit/audit-service", () => ({
      createAuditLogEntry: mockCreateAuditLogEntry,
    }));

    const { importCases } = await import(
      "@/app/_lib/actions/import-actions"
    );

    const fd = makeFormData([
      { id: 100, ClientId: 999, name: "不存在的族人案件", status: "處理中" },
    ], "skip");

    const result = await importCases(fd);

    expect(result.success).toBe(true);
    expect(result.table).toBe("cases");
    expect(result.total).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.inserted).toBe(0);

    // Verify ValidationError with FK violation message
    const refError = result.errors.find(
      (e) => e.field === "client_id" && e.message.includes("不存在於資料庫"),
    );
    expect(refError).toBeDefined();
    expect(refError!.index).toBe(1);
    expect(refError!.value).toBe(999);
  });
});

describe("Integration: import audit log format", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("calls createAuditLogEntry with entityType=Import, action=IMPORT, and correct newData", async () => {
    const mockExecuteRawUnsafe = vi.fn()
      // Record insert returns 1 (inserted)
      .mockResolvedValueOnce(1)
      // Sequence reset
      .mockResolvedValueOnce(undefined);

    const mockCreateAuditLogEntry = vi.fn().mockResolvedValue(undefined);

    vi.doMock("@/app/_lib/db", () => ({
      prisma: {
        $executeRawUnsafe: mockExecuteRawUnsafe,
      },
    }));

    vi.doMock("@/app/_lib/auth", () => ({
      auth: vi.fn().mockResolvedValue({
        user: { id: "42", email: "admin@test.com", role: "admin" },
      }),
    }));

    vi.doMock("@/app/_lib/audit/audit-service", () => ({
      createAuditLogEntry: mockCreateAuditLogEntry,
    }));

    const { importClients } = await import(
      "@/app/_lib/actions/import-actions"
    );

    const fd = makeFormData(
      [{ id: 1, name: "測試族人" }],
      "skip",
      "my-import.json",
    );

    await importClients(fd);

    // Verify audit log was called
    expect(mockCreateAuditLogEntry).toHaveBeenCalledTimes(1);

    const auditCall = mockCreateAuditLogEntry.mock.calls[0][0];
    expect(auditCall.entityType).toBe("Import");
    expect(auditCall.action).toBe("IMPORT");
    expect(auditCall.userId).toBe(42);
    expect(auditCall.userEmail).toBe("admin@test.com");
    expect(auditCall.oldData).toBeNull();
    expect(auditCall.changedFields).toEqual([]);

    // Verify newData contains correct fields
    const newData = auditCall.newData;
    expect(newData.table).toBe("clients");
    expect(newData.fileName).toBe("my-import.json");
    expect(newData.conflictStrategy).toBe("skip");
    expect(typeof newData.inserted).toBe("number");
    expect(typeof newData.overwritten).toBe("number");
    expect(typeof newData.skipped).toBe("number");
    expect(typeof newData.failed).toBe("number");
  });
});
