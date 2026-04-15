/**
 * Shared import utilities extracted from prisma/seed.ts.
 *
 * These pure functions and value sets are the single source of truth
 * for legacy JSON → DB field mapping. Both the Web UI import and the
 * CLI seed script should use them.
 */

// Import and re-export the relationship inverse map from the existing constants module
// (identical to the copy in seed.ts).
import { RELATIONSHIP_INVERSE_MAP } from "@/app/_lib/constants/relationship-map";
export { RELATIONSHIP_INVERSE_MAP };

// ── Enum value sets (exactly matching seed.ts) ──

export const VALID_GROUPS = new Set([
  "阿美", "泰雅", "布農", "卡那卡那富", "噶瑪蘭", "排灣",
  "卑南", "魯凱", "拉阿魯哇", "賽夏", "撒奇萊雅", "賽德克",
  "太魯閣", "邵", "鄒", "雅美",
]);

export const VALID_PLAIN_MOUNTAIN = new Set(["平原", "山原"]);

export const VALID_INCOME_STATUS = new Set(["low", "mid-low", "mid-low-elderly"]);

export const VALID_DISABLED_STATUS = new Set(["light", "mid", "heavy"]);

export const VALID_CASE_STATUS = new Set(["處理中", "結案"]);

export const VALID_CASE_TYPE_MAJOR = new Set(["一般", "法律", "急難救助"]);

export const VALID_CASE_TYPE_MINOR = new Set([
  "一般", "求職", "陳情", "施政建議", "債務", "勞資",
  "車禍", "家事", "繼承", "刑事", "諮詢", "非訟",
  "生活扶助", "死亡救助", "急難紓困", "重大災害", "醫療補助",
]);

export const VALID_CONTACT_TYPE = new Set(["撥出", "來電", "親訪", "簡訊"]);


// ── Pure helper functions (logic identical to seed.ts) ──

/** Return trimmed value if it exists in the valid set, otherwise null */
export function validateEnum(
  value: string | null | undefined,
  validSet: Set<string>,
): string | null {
  if (!value || value.trim() === "") return null;
  const trimmed = value.trim();
  return validSet.has(trimmed) ? trimmed : null;
}

export function emptyToNull(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") return null;
  return value.trim();
}

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Coerce empty strings / non-booleans to a boolean with a default */
export function toBool(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "" || value === null || value === undefined) return defaultValue;
  return Boolean(value);
}

// ── Interfaces ──

export interface ValidationError {
  index: number;       // 1-based record index
  field: string;       // field name
  value: unknown;      // original value
  message: string;     // error description
}

export interface MappedRecord {
  data: Record<string, unknown>;   // mapped DB-ready fields
  errors: ValidationError[];       // validation warnings for this record
}

export type ParseResult =
  | { success: true; records: Record<string, unknown>[] }
  | { success: false; error: string };

// ── Helper: record enum validation error ──

function enumError(
  index: number,
  field: string,
  value: unknown,
): ValidationError {
  return {
    index,
    field,
    value,
    message: "不合法的列舉值",
  };
}

/**
 * Validate an enum value and optionally record a ValidationError.
 * Returns the validated value (or null) and pushes an error if invalid.
 */
function validateEnumWithError(
  value: string | null | undefined,
  validSet: Set<string>,
  index: number,
  field: string,
  errors: ValidationError[],
): string | null {
  const result = validateEnum(value, validSet);
  if (result === null && value != null && typeof value === "string" && value.trim() !== "") {
    errors.push(enumError(index, field, value));
  }
  return result;
}

// ── Field mapping functions ──

/**
 * Map a legacy client JSON record to DB-ready fields.
 * Transformation logic is identical to seed.ts $executeRawUnsafe for clients.
 */
export function mapClientRecord(
  raw: Record<string, unknown>,
  index: number,
): MappedRecord {
  const errors: ValidationError[] = [];

  const data: Record<string, unknown> = {
    id: raw.id,
    name: emptyToNull(raw.name as string | null | undefined),
    name_alt: emptyToNull(raw.nameAlt as string | null | undefined),
    idn: emptyToNull(raw.IDN as string | null | undefined),
    sex: emptyToNull(raw.sex as string | null | undefined),
    birthday: parseDate(raw.birthday as string | null | undefined),
    is_dead: toBool(raw.isDead, false),
    household_admin: toBool(
      (raw.householdadmin ?? raw.householdAdmin) as unknown,
      false,
    ),
    income_status: validateEnumWithError(
      raw.incomeStatus as string | null | undefined,
      VALID_INCOME_STATUS,
      index,
      "incomeStatus",
      errors,
    ),
    disabled_status: validateEnumWithError(
      raw.disabledStatus as string | null | undefined,
      VALID_DISABLED_STATUS,
      index,
      "disabledStatus",
      errors,
    ),
    indigenous_group: validateEnumWithError(
      raw.group as string | null | undefined,
      VALID_GROUPS,
      index,
      "group",
      errors,
    ),
    tribe: emptyToNull(raw.tribe as string | null | undefined),
    plain_mountain: validateEnumWithError(
      raw.plainMountain as string | null | undefined,
      VALID_PLAIN_MOUNTAIN,
      index,
      "plainMountain",
      errors,
    ),
    can_call: toBool(raw.canCall, true),
    phone: emptyToNull(raw.phone as string | null | undefined),
    phone_note: emptyToNull(raw.phoneNote as string | null | undefined),
    phone_alt: emptyToNull(raw.phoneAlt as string | null | undefined),
    phone_alt_note: emptyToNull(raw.phoneAltNote as string | null | undefined),
    mobile: emptyToNull(raw.mobile as string | null | undefined),
    mobile_note: emptyToNull(raw.mobileNote as string | null | undefined),
    mobile_alt: emptyToNull(raw.mobileAlt as string | null | undefined),
    mobile_alt_note: emptyToNull(
      raw.mobileAltNote as string | null | undefined,
    ),
    can_mail: toBool(raw.canMail, true),
    city: emptyToNull(raw.city as string | null | undefined),
    city_alt: emptyToNull(raw.cityAlt as string | null | undefined),
    dist: emptyToNull(raw.dist as string | null | undefined),
    dist_alt: emptyToNull(raw.distAlt as string | null | undefined),
    vill: emptyToNull(raw.vill as string | null | undefined),
    vill_alt: emptyToNull(raw.villAlt as string | null | undefined),
    addr: emptyToNull(raw.addr as string | null | undefined),
    addr_alt: emptyToNull(raw.addrAlt as string | null | undefined),
    addr_note: emptyToNull(raw.addrNote as string | null | undefined),
    addr_alt_note: emptyToNull(raw.addrAltNote as string | null | undefined),
    note: emptyToNull(raw.note as string | null | undefined),
    created_at:
      parseDate(raw.createdAt as string | null | undefined) ?? new Date(),
    updated_at:
      parseDate(raw.updatedAt as string | null | undefined) ?? new Date(),
  };

  return { data, errors };
}

/**
 * Map a legacy case JSON record to DB-ready fields.
 * Transformation logic is identical to seed.ts $executeRawUnsafe for cases.
 */
export function mapCaseRecord(
  raw: Record<string, unknown>,
  index: number,
): MappedRecord {
  const errors: ValidationError[] = [];

  const data: Record<string, unknown> = {
    id: raw.id,
    name: emptyToNull(raw.name as string | null | undefined),
    status: validateEnumWithError(
      raw.status as string | null | undefined,
      VALID_CASE_STATUS,
      index,
      "status",
      errors,
    ),
    types_major: validateEnumWithError(
      raw.typesMajor as string | null | undefined,
      VALID_CASE_TYPE_MAJOR,
      index,
      "typesMajor",
      errors,
    ),
    types_minor: validateEnumWithError(
      raw.typesMinor as string | null | undefined,
      VALID_CASE_TYPE_MINOR,
      index,
      "typesMinor",
      errors,
    ),
    relation1: emptyToNull(raw.relation1 as string | null | undefined),
    relation2: emptyToNull(raw.relation2 as string | null | undefined),
    relation3: emptyToNull(raw.relation3 as string | null | undefined),
    contact1: emptyToNull(raw.contact1 as string | null | undefined),
    contact2: emptyToNull(raw.contact2 as string | null | undefined),
    contact3: emptyToNull(raw.contact3 as string | null | undefined),
    note: emptyToNull(raw.note as string | null | undefined),
    handle: emptyToNull(raw.handle as string | null | undefined),
    person_in_charge_legacy: emptyToNull(
      raw.personInCharge as string | null | undefined,
    ),
    client_id: raw.ClientId,
    created_at:
      parseDate(raw.createdAt as string | null | undefined) ?? new Date(),
    updated_at:
      parseDate(raw.updatedAt as string | null | undefined) ?? new Date(),
  };

  return { data, errors };
}

/**
 * Map a legacy contact JSON record to DB-ready fields.
 * Transformation logic is identical to seed.ts $executeRawUnsafe for contacts.
 *
 * Note: seed.ts uses `c.isSuccess ?? true` (nullish coalescing) rather than
 * toBool for the is_success field. We replicate this exactly.
 */
export function mapContactRecord(
  raw: Record<string, unknown>,
  index: number,
): MappedRecord {
  const errors: ValidationError[] = [];

  const data: Record<string, unknown> = {
    id: raw.id,
    date: parseDate(raw.date as string | null | undefined),
    contact_type: validateEnumWithError(
      raw.contactType as string | null | undefined,
      VALID_CONTACT_TYPE,
      index,
      "contactType",
      errors,
    ),
    is_success: (raw.isSuccess as boolean | null | undefined) ?? true,
    record: emptyToNull(raw.record as string | null | undefined),
    person_in_charge_legacy: emptyToNull(
      raw.personInCharge as string | null | undefined,
    ),
    client_id: raw.ClientId,
    created_at:
      parseDate(raw.createdAt as string | null | undefined) ?? new Date(),
    updated_at:
      parseDate(raw.updatedAt as string | null | undefined) ?? new Date(),
  };

  return { data, errors };
}

/**
 * Map a legacy family JSON record to DB-ready fields.
 * Transformation logic is identical to seed.ts $executeRawUnsafe for families.
 *
 * Uses RELATIONSHIP_INVERSE_MAP and clientSexMap to compute relation_b_to_a,
 * falling back to the original relationship if no inverse mapping exists.
 */
export function mapFamilyRecord(
  raw: Record<string, unknown>,
  index: number,
  clientSexMap: Map<number, string>,
): MappedRecord {
  const errors: ValidationError[] = [];

  const sourceId = raw.ClientId as number;
  const targetId = raw.FamilyId as number;
  const relationship = raw.relationship as string;

  const sourceSex = clientSexMap.get(sourceId);
  const inverse = sourceSex
    ? (RELATIONSHIP_INVERSE_MAP[relationship]?.[sourceSex] ?? relationship)
    : relationship;

  const data: Record<string, unknown> = {
    person_a_id: sourceId,
    person_b_id: targetId,
    relation_a_to_b: relationship,
    relation_b_to_a: inverse,
  };

  return { data, errors };
}

/** Parse a JSON string and validate it is a non-empty array of records. */
export function parseJsonPayload(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { success: false, error: "檔案格式錯誤：無法解析 JSON" };
  }

  if (!Array.isArray(parsed)) {
    return { success: false, error: "檔案內容必須為 JSON 陣列" };
  }

  if (parsed.length === 0) {
    return { success: false, error: "檔案不包含任何記錄" };
  }

  return { success: true, records: parsed as Record<string, unknown>[] };
}
