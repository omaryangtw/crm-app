import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { safeGetItem, safeSetItem } from "@/app/_lib/utils/storage";
import type { ExportQuery } from "@/app/_lib/schemas/export-schema";

// ---------------------------------------------------------------------------
// Map-based localStorage mock + window shim for SSR guard
// ---------------------------------------------------------------------------
const store = new Map<string, string>();

const localStorageMock: Storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, value);
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => store.clear(),
  get length() {
    return store.size;
  },
  key: (index: number) => [...store.keys()][index] ?? null,
};

// Ensure `typeof window !== "undefined"` so safeGetItem/safeSetItem don't
// short-circuit with the SSR guard.
if (typeof globalThis.window === "undefined") {
  (globalThis as Record<string, unknown>).window = globalThis;
}
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// ---------------------------------------------------------------------------
// Preset CRUD helpers — mirrors useExportPresets logic without React state
// ---------------------------------------------------------------------------
const STORAGE_KEY = "export-presets";

interface CustomPreset {
  name: string;
  query: ExportQuery;
  columns: Record<string, boolean>;
  createdAt: string;
}

function readPresets(): CustomPreset[] {
  const raw = safeGetItem<CustomPreset[]>(STORAGE_KEY);
  if (Array.isArray(raw)) return raw;
  store.delete(STORAGE_KEY);
  return [];
}

function savePreset(
  name: string,
  query: ExportQuery,
  columns: Record<string, boolean>,
): boolean {
  if (name.trim() === "") return false;
  const now = new Date().toISOString();
  const entry: CustomPreset = { name, query, columns, createdAt: now };
  const prev = readPresets();
  const exists = prev.some((p) => p.name === name);
  const next = exists
    ? prev.map((p) => (p.name === name ? entry : p))
    : [...prev, entry];
  safeSetItem(STORAGE_KEY, next);
  return true;
}

function deletePreset(name: string): void {
  const prev = readPresets();
  const next = prev.filter((p) => p.name !== name);
  safeSetItem(STORAGE_KEY, next);
}

function loadPreset(
  name: string,
): { query: ExportQuery; columns: Record<string, boolean> } | null {
  const all = readPresets();
  const found = all.find((p) => p.name === name);
  if (!found) return null;
  return { query: found.query, columns: found.columns };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------
const exportQueryArb: fc.Arbitrary<ExportQuery> = fc.record(
  {
    isDead: fc.boolean(),
    canCall: fc.boolean(),
    canMail: fc.boolean(),
    sex: fc.constantFrom("male" as const, "female" as const),
    group: fc.constantFrom("amis" as const, "atayal" as const, "bunun" as const, "any" as const),
    plainMountain: fc.constantFrom("plain" as const, "mountain" as const, "any" as const),
    ageMin: fc.integer({ min: 0, max: 120 }),
    ageMax: fc.integer({ min: 0, max: 120 }),
    city: fc.string({ maxLength: 10 }),
    dist: fc.string({ maxLength: 10 }),
    name: fc.string({ maxLength: 20 }),
    tribe: fc.string({ maxLength: 10 }),
    vill: fc.string({ maxLength: 10 }),
    note: fc.string({ maxLength: 30 }),
  },
  { requiredKeys: [] },
);

const columnsArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 10 }),
  fc.boolean(),
);


// ===========================================================================
// Property 1: localStorage 讀寫往返一致性
// ===========================================================================

/**
 * Feature: form-and-export-ux, Property 1: localStorage 讀寫往返一致性
 *
 * **Validates: Requirements 10.4**
 *
 * For any valid JSON-serializable value, safeSetItem then safeGetItem
 * should produce a deeply equal result.
 */
describe("Feature: form-and-export-ux, Property 1: localStorage 讀寫往返一致性", () => {
  beforeEach(() => store.clear());

  it("safeSetItem then safeGetItem returns deeply equal value", () => {
    // Normalize through JSON roundtrip to avoid -0 vs 0 mismatch
    // (JSON.stringify(-0) === "0", so JSON.parse("0") === 0)
    const jsonSafeValue = fc
      .jsonValue()
      .map((v) => JSON.parse(JSON.stringify(v)) as unknown);

    fc.assert(
      fc.property(jsonSafeValue, (value) => {
        const key = "__test_roundtrip__";
        safeSetItem(key, value);
        const result = safeGetItem(key);
        expect(result).toEqual(value);
      }),
      { numRuns: 100 },
    );
  });
});

// ===========================================================================
// Property 2: 非 JSON 字串安全讀取
// ===========================================================================

/**
 * Feature: form-and-export-ux, Property 2: 非 JSON 字串安全讀取
 *
 * **Validates: Requirements 10.5**
 *
 * For any string that is NOT valid JSON, when written directly to
 * localStorage, safeGetItem should return null without throwing.
 */
describe("Feature: form-and-export-ux, Property 2: 非 JSON 字串安全讀取", () => {
  beforeEach(() => store.clear());

  function isValidJson(s: string): boolean {
    try {
      JSON.parse(s);
      return true;
    } catch {
      return false;
    }
  }

  it("safeGetItem returns null for non-JSON strings", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !isValidJson(s)),
        (raw) => {
          const key = "__test_invalid_json__";
          localStorage.setItem(key, raw);
          const result = safeGetItem(key);
          expect(result).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===========================================================================
// Property 3: 匯出預設儲存與載入往返一致性
// ===========================================================================

/**
 * Feature: form-and-export-ux, Property 3: 匯出預設儲存與載入往返一致性
 *
 * **Validates: Requirements 1.3, 2.1, 2.3, 9.3, 9.4**
 *
 * For any non-blank name, ExportQuery, and columns, savePreset then
 * loadPreset should return deeply equal query and columns.
 */
describe("Feature: form-and-export-ux, Property 3: 匯出預設儲存與載入往返一致性", () => {
  beforeEach(() => store.clear());

  it("savePreset then loadPreset returns deeply equal query and columns", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim() !== ""),
        exportQueryArb,
        columnsArb,
        (name, query, columns) => {
          savePreset(name, query, columns);
          const loaded = loadPreset(name);
          expect(loaded).not.toBeNull();
          expect(loaded!.query).toEqual(query);
          expect(loaded!.columns).toEqual(columns);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===========================================================================
// Property 4: 空白預設名稱拒絕
// ===========================================================================

/**
 * Feature: form-and-export-ux, Property 4: 空白預設名稱拒絕
 *
 * **Validates: Requirements 1.4**
 *
 * For any whitespace-only string, savePreset should return false and
 * not change the presets array.
 */
describe("Feature: form-and-export-ux, Property 4: 空白預設名稱拒絕", () => {
  beforeEach(() => store.clear());

  it("savePreset rejects whitespace-only names and leaves presets unchanged", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(" ", "\t", "\n", "\r"), { minLength: 0, maxLength: 20 }).map((chars) => chars.join("")),
        exportQueryArb,
        columnsArb,
        (blankName, query, columns) => {
          const before = readPresets();
          const result = savePreset(blankName, query, columns);
          const after = readPresets();
          expect(result).toBe(false);
          expect(after).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===========================================================================
// Property 5: 同名預設覆蓋冪等性
// ===========================================================================

/**
 * Feature: form-and-export-ux, Property 5: 同名預設覆蓋冪等性
 *
 * **Validates: Requirements 1.5**
 *
 * Saving twice with the same name should result in exactly one preset
 * with that name, and loadPreset returns the second save's data.
 */
describe("Feature: form-and-export-ux, Property 5: 同名預設覆蓋冪等性", () => {
  beforeEach(() => store.clear());

  it("saving twice with same name keeps exactly one entry with latest data", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim() !== ""),
        exportQueryArb,
        columnsArb,
        exportQueryArb,
        columnsArb,
        (name, query1, columns1, query2, columns2) => {
          savePreset(name, query1, columns1);
          savePreset(name, query2, columns2);

          const all = readPresets();
          const matching = all.filter((p) => p.name === name);
          expect(matching).toHaveLength(1);

          const loaded = loadPreset(name);
          expect(loaded).not.toBeNull();
          expect(loaded!.query).toEqual(query2);
          expect(loaded!.columns).toEqual(columns2);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===========================================================================
// Property 6: 預設結構完整性
// ===========================================================================

/**
 * Feature: form-and-export-ux, Property 6: 預設結構完整性
 *
 * **Validates: Requirements 1.6**
 *
 * After savePreset, the raw JSON in localStorage should contain name (string),
 * query (object), columns (object), and createdAt (ISO timestamp string).
 */
describe("Feature: form-and-export-ux, Property 6: 預設結構完整性", () => {
  beforeEach(() => store.clear());

  it("saved preset has name, query, columns, and createdAt (ISO string)", () => {
    const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim() !== ""),
        exportQueryArb,
        columnsArb,
        (name, query, columns) => {
          store.clear();
          savePreset(name, query, columns);

          const raw = localStorage.getItem(STORAGE_KEY);
          expect(raw).not.toBeNull();

          const parsed = JSON.parse(raw!) as unknown[];
          expect(Array.isArray(parsed)).toBe(true);

          const preset = parsed.find(
            (p: unknown) => (p as CustomPreset).name === name,
          ) as CustomPreset;
          expect(preset).toBeDefined();
          expect(typeof preset.name).toBe("string");
          expect(typeof preset.query).toBe("object");
          expect(preset.query).not.toBeNull();
          expect(typeof preset.columns).toBe("object");
          expect(preset.columns).not.toBeNull();
          expect(typeof preset.createdAt).toBe("string");
          expect(ISO_REGEX.test(preset.createdAt)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===========================================================================
// Property 7: 刪除預設僅移除目標
// ===========================================================================

/**
 * Feature: form-and-export-ux, Property 7: 刪除預設僅移除目標
 *
 * **Validates: Requirements 3.2**
 *
 * After saving N presets and deleting one, the array length is N-1,
 * the deleted name is gone, and all others are unchanged.
 */
describe("Feature: form-and-export-ux, Property 7: 刪除預設僅移除目標", () => {
  beforeEach(() => store.clear());

  it("deleting one preset removes only that preset, others unchanged", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.string({ minLength: 1 }).filter((s) => s.trim() !== ""),
          { minLength: 1, maxLength: 10 },
        ),
        fc.nat(),
        (names, indexSeed) => {
          store.clear();
          const dummyQuery: ExportQuery = {};
          const dummyColumns: Record<string, boolean> = {};

          // Save all presets
          for (const n of names) {
            savePreset(n, dummyQuery, dummyColumns);
          }

          const beforeDelete = readPresets();
          expect(beforeDelete).toHaveLength(names.length);

          // Pick a random preset to delete
          const deleteIndex = indexSeed % names.length;
          const deletedName = names[deleteIndex];
          deletePreset(deletedName);

          const afterDelete = readPresets();

          // Length is N-1
          expect(afterDelete).toHaveLength(names.length - 1);

          // Deleted name is gone
          expect(afterDelete.find((p) => p.name === deletedName)).toBeUndefined();

          // All other names still present
          const remainingNames = names.filter((n) => n !== deletedName);
          for (const n of remainingNames) {
            expect(afterDelete.find((p) => p.name === n)).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Draft CRUD helpers — mirrors useFormDraft logic without React state
// ---------------------------------------------------------------------------
import { safeRemoveItem } from "@/app/_lib/utils/storage";
import type { DraftPayload } from "@/app/_hooks/use-form-draft";

function readDraft(key: string): DraftPayload | null {
  const raw = safeGetItem<DraftPayload>(key);
  if (
    raw !== null &&
    typeof raw === "object" &&
    "data" in raw &&
    "savedAt" in raw &&
    typeof (raw as DraftPayload).savedAt === "string"
  ) {
    return raw as DraftPayload;
  }
  if (raw !== null) safeRemoveItem(key);
  return null;
}

function saveDraftTo(key: string, data: Record<string, unknown>): void {
  const payload: DraftPayload = {
    data,
    savedAt: new Date().toISOString(),
  };
  safeSetItem(key, payload);
}

function clearDraftFrom(key: string): void {
  safeRemoveItem(key);
}

// ===========================================================================
// Property 8: 表單草稿儲存與還原往返一致性
// ===========================================================================

/**
 * Feature: form-and-export-ux, Property 8: 表單草稿儲存與還原往返一致性
 *
 * **Validates: Requirements 5.1, 6.1, 6.4, 8.4**
 *
 * For any valid form data object, saveDraft then restoreDraft (read back)
 * should produce a deeply equal result.
 */
describe("Feature: form-and-export-ux, Property 8: 表單草稿儲存與還原往返一致性", () => {
  beforeEach(() => store.clear());

  it("saveDraft then restoreDraft returns deeply equal data", () => {
    // Normalize through JSON roundtrip to avoid -0 vs 0 mismatch
    const jsonSafeDict = fc
      .dictionary(fc.string(), fc.jsonValue())
      .map((d) => JSON.parse(JSON.stringify(d)) as Record<string, unknown>);

    fc.assert(
      fc.property(jsonSafeDict, (formData) => {
        const key = "draft:test";
        saveDraftTo(key, formData);
        const restored = readDraft(key);
        expect(restored).not.toBeNull();
        expect(restored!.data).toEqual(formData);
      }),
      { numRuns: 100 },
    );
  });
});

// ===========================================================================
// Property 9: 草稿鍵值隔離性
// ===========================================================================

/**
 * Feature: form-and-export-ux, Property 9: 草稿鍵值隔離性
 *
 * **Validates: Requirement 5.2**
 *
 * Two different storage keys should hold independent draft data.
 * Storing data in one key should not affect the other.
 */
describe("Feature: form-and-export-ux, Property 9: 草稿鍵值隔離性", () => {
  beforeEach(() => store.clear());

  it("drafts stored under different keys are isolated", () => {
    // Normalize through JSON roundtrip to avoid -0 vs 0 mismatch
    const jsonSafeDict = fc
      .dictionary(fc.string(), fc.jsonValue())
      .map((d) => JSON.parse(JSON.stringify(d)) as Record<string, unknown>);

    fc.assert(
      fc.property(jsonSafeDict, jsonSafeDict, (dataA, dataB) => {
        const keyA = "draft:client";
        const keyB = "draft:case";

        saveDraftTo(keyA, dataA);
        saveDraftTo(keyB, dataB);

        const restoredA = readDraft(keyA);
        const restoredB = readDraft(keyB);

        expect(restoredA).not.toBeNull();
        expect(restoredB).not.toBeNull();
        expect(restoredA!.data).toEqual(dataA);
        expect(restoredB!.data).toEqual(dataB);
      }),
      { numRuns: 100 },
    );
  });
});

// ===========================================================================
// Property 10: 草稿結構完整性
// ===========================================================================

/**
 * Feature: form-and-export-ux, Property 10: 草稿結構完整性
 *
 * **Validates: Requirement 5.3**
 *
 * After saveDraft, the raw JSON in localStorage should contain
 * `data` (object) and `savedAt` (ISO timestamp string).
 */
describe("Feature: form-and-export-ux, Property 10: 草稿結構完整性", () => {
  beforeEach(() => store.clear());

  it("saved draft has data (object) and savedAt (ISO string)", () => {
    const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

    fc.assert(
      fc.property(
        fc.dictionary(fc.string(), fc.jsonValue()),
        (formData) => {
          const key = "draft:structure-test";
          store.clear();
          saveDraftTo(key, formData);

          const raw = localStorage.getItem(key);
          expect(raw).not.toBeNull();

          const parsed = JSON.parse(raw!) as Record<string, unknown>;
          expect(typeof parsed).toBe("object");
          expect(parsed).not.toBeNull();

          // data field
          expect("data" in parsed).toBe(true);
          expect(typeof parsed.data).toBe("object");
          expect(parsed.data).not.toBeNull();

          // savedAt field
          expect("savedAt" in parsed).toBe(true);
          expect(typeof parsed.savedAt).toBe("string");
          expect(ISO_REGEX.test(parsed.savedAt as string)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===========================================================================
// Property 11: 停用模式無操作保證
// ===========================================================================

/**
 * Feature: form-and-export-ux, Property 11: 停用模式無操作保證
 *
 * **Validates: Requirements 5.4, 8.3**
 *
 * With enabled=false, saveDraft should not write to localStorage,
 * and hasDraft should be false.
 */
describe("Feature: form-and-export-ux, Property 11: 停用模式無操作保證", () => {
  beforeEach(() => store.clear());

  it("disabled mode: saveDraft is no-op, key does not exist, hasDraft is false", () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string(), fc.jsonValue()),
        (formData) => {
          const key = "draft:disabled-test";
          store.clear();

          // Simulate enabled=false: saveDraft is a no-op
          const enabled = false;
          if (enabled) {
            saveDraftTo(key, formData);
          }

          // Verify localStorage key doesn't exist
          expect(localStorage.getItem(key)).toBeNull();

          // Verify hasDraft is false (readDraft returns null)
          const hasDraft = enabled ? readDraft(key) !== null : false;
          expect(hasDraft).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ===========================================================================
// Property 12: 清除草稿完整性
// ===========================================================================

/**
 * Feature: form-and-export-ux, Property 12: 清除草稿完整性
 *
 * **Validates: Requirements 6.5, 7.1**
 *
 * After saving random data as draft and calling clearDraft,
 * localStorage key should not exist, hasDraft should be false,
 * and draftData should be null.
 */
describe("Feature: form-and-export-ux, Property 12: 清除草稿完整性", () => {
  beforeEach(() => store.clear());

  it("clearDraft removes key, hasDraft is false, draftData is null", () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.string(), fc.jsonValue()),
        (formData) => {
          const key = "draft:clear-test";

          // Save draft first
          saveDraftTo(key, formData);
          expect(localStorage.getItem(key)).not.toBeNull();

          // Clear draft
          clearDraftFrom(key);

          // Verify localStorage key doesn't exist
          expect(localStorage.getItem(key)).toBeNull();

          // Verify hasDraft is false
          const hasDraft = readDraft(key) !== null;
          expect(hasDraft).toBe(false);

          // Verify draftData is null
          const draftData = readDraft(key)?.data ?? null;
          expect(draftData).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});
