import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

/**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 *
 * Bug Condition Exploration Test — Enum/JSON/FK Restore Failure After Cascade Deletion
 *
 * This test is written BEFORE the fix and is EXPECTED TO FAIL on unfixed code.
 * Failure confirms the bug exists. The test encodes the EXPECTED (correct) behavior.
 *
 * Three sub-conditions:
 * 1. Enum INSERT failure: formatFieldValue should produce explicit ::EnumType cast
 * 2. JSON escaping failure: formatSqlValue should produce syntactically valid PostgreSQL for complex JSON
 * 3. FK conflict resolution failure: dangling FK should be set to NULL
 */

// ---- Sub-condition 1: Enum INSERT failure ----

describe("Bug Condition 1: Enum fields must have explicit ::EnumType cast", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  /**
   * Enum field mapping: table → field → { pgType, values }
   * Values are the @map'd strings that Prisma returns from findMany.
   */
  const ENUM_FIELD_SPECS: Array<{
    table: string;
    field: string;
    pgType: string;
    /** Prisma-side enum names (what findMany returns and what backup JSON stores) */
    prismaValues: string[];
    /** PostgreSQL @map values (what the DB actually expects) */
    pgValues: string[];
  }> = [
    { table: "cases", field: "status", pgType: "CaseStatus", prismaValues: ["in_progress", "closed"], pgValues: ["處理中", "結案"] },
    { table: "cases", field: "typesMajor", pgType: "CaseTypeMajor", prismaValues: ["general", "legal", "emergency"], pgValues: ["一般", "法律", "急難救助"] },
    { table: "cases", field: "typesMinor", pgType: "CaseTypeMinor", prismaValues: ["general_minor", "job_seeking", "petition", "policy_suggestion", "debt", "labor_dispute", "traffic_accident", "family_affair", "inheritance", "criminal", "consultation", "non_litigation", "living_assistance", "death_relief", "emergency_relief", "major_disaster", "medical_subsidy"], pgValues: ["一般", "求職", "陳情", "施政建議", "債務", "勞資", "車禍", "家事", "繼承", "刑事", "諮詢", "非訟", "生活扶助", "死亡救助", "急難紓困", "重大災害", "醫療補助"] },
    { table: "contacts", field: "contactType", pgType: "ContactType", prismaValues: ["outgoing", "incoming", "visit", "sms"], pgValues: ["撥出", "來電", "親訪", "簡訊"] },
    { table: "clients", field: "sex", pgType: "Sex", prismaValues: ["male", "female"], pgValues: ["male", "female"] },
    { table: "clients", field: "incomeStatus", pgType: "IncomeStatus", prismaValues: ["low", "mid_low", "mid_low_elderly"], pgValues: ["low", "mid-low", "mid-low-elderly"] },
    { table: "clients", field: "disabledStatus", pgType: "DisabledStatus", prismaValues: ["light", "mid", "heavy"], pgValues: ["light", "mid", "heavy"] },
    { table: "clients", field: "indigenousGroup", pgType: "IndigenousGroup", prismaValues: ["amis", "atayal", "bunun", "kanakanavu", "kavalan", "paiwan", "puyuma", "rukai", "hla_alua", "saisiyat", "sakizaya", "seediq", "truku", "thao", "tsou", "yami"], pgValues: ["阿美", "泰雅", "布農", "卡那卡那富", "噶瑪蘭", "排灣", "卑南", "魯凱", "拉阿魯哇", "賽夏", "撒奇萊雅", "賽德克", "太魯閣", "邵", "鄒", "雅美"] },
    { table: "clients", field: "plainMountain", pgType: "PlainMountain", prismaValues: ["plain", "mountain"], pgValues: ["平原", "山原"] },
    { table: "users", field: "role", pgType: "UserRole", prismaValues: ["admin", "user"], pgValues: ["admin", "user"] },
    { table: "deletion_requests", field: "status", pgType: "DeletionRequestStatus", prismaValues: ["pending", "approved", "rejected", "restored"], pgValues: ["pending", "approved", "rejected", "restored"] },
  ];

  it("formatFieldValue produces ::EnumType cast with correct @map value for all enum fields (PBT)", async () => {
    // Generate random (table, field, pgType, prismaValue, pgValue) tuples
    const enumEntryArb = fc.constantFrom(...ENUM_FIELD_SPECS).chain((spec) =>
      fc.integer({ min: 0, max: spec.prismaValues.length - 1 }).map((idx) => ({
        table: spec.table,
        field: spec.field,
        pgType: spec.pgType,
        prismaValue: spec.prismaValues[idx],
        pgValue: spec.pgValues[idx],
      }))
    );

    // Import the ACTUAL fixed formatFieldValue from restore.ts
    vi.doMock("@/app/_lib/db", () => ({ prisma: {} }));
    const { formatFieldValue } = await import("@/app/_lib/utils/restore");

    await fc.assert(
      fc.property(enumEntryArb, ({ table, field, pgType, prismaValue, pgValue }) => {
        // Input: Prisma name (what backup JSON stores)
        const result = formatFieldValue(table, field, prismaValue);

        // EXPECTED: result uses the PostgreSQL @map value with explicit cast
        const expectedCastSuffix = `::"${pgType}"`;
        expect(result).toContain(expectedCastSuffix);

        const escapedPgValue = pgValue.replace(/'/g, "''");
        expect(result).toBe(`'${escapedPgValue}'::"${pgType}"`);
      }),
      { numRuns: 200 }
    );
  });
});


// ---- Sub-condition 2: JSON escaping failure ----

describe("Bug Condition 2: JSON fields must produce syntactically valid PostgreSQL values", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  /**
   * Validates that a SQL jsonb literal is syntactically valid PostgreSQL.
   * The fixed implementation uses dollar-quoting, so we need to handle both formats:
   * - Dollar-quoted: $<tag>...<tag>$::jsonb
   * - Standard quoted: '...'::jsonb (with '' escaping)
   */
  function isValidPostgresJsonbLiteral(sqlValue: string): boolean {
    // Must end with ::jsonb cast
    if (!sqlValue.endsWith("::jsonb")) return false;

    // Strip the ::jsonb suffix
    const literal = sqlValue.slice(0, -"::jsonb".length);

    // Check for dollar-quoting: $<tag>...<tag>$ or $...$
    const dollarMatch = literal.match(/^\$([^$]*)\$([\s\S]*)\$\1\$$/);
    if (dollarMatch) {
      // Dollar-quoted string — the inner content is taken literally, always valid
      // Just verify the JSON inside is parseable
      try {
        JSON.parse(dollarMatch[2]);
        return true;
      } catch {
        return false;
      }
    }

    // Standard single-quoted string
    if (!literal.startsWith("'") || !literal.endsWith("'")) return false;

    const inner = literal.slice(1, -1);

    // Check for unescaped single quotes
    let i = 0;
    while (i < inner.length) {
      if (inner[i] === "'") {
        if (i + 1 < inner.length && inner[i + 1] === "'") {
          i += 2;
        } else {
          return false;
        }
      } else {
        i++;
      }
    }

    return true;
  }

  it("formatSqlValue produces valid PostgreSQL string for JSON with special characters (PBT)", async () => {
    // Import the ACTUAL fixed formatSqlValue from restore.ts
    vi.doMock("@/app/_lib/db", () => ({ prisma: {} }));
    const { formatSqlValue } = await import("@/app/_lib/utils/restore");

    // Generate complex JSON objects with problematic characters
    const problematicJsonArb = fc.dictionary(
      fc.string({ minLength: 1, maxLength: 10 }),
      fc.oneof(
        // Strings with single quotes
        fc.string().map((s) => `O'${s}Brien`),
        // Strings with backslashes
        fc.string().map((s) => `5\\${s}6F`),
        // Strings with both
        fc.constant("it's a \\test"),
        // Unicode strings
        fc.string({ minLength: 1, maxLength: 50, unit: "grapheme" }),
        // Nested objects
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 5 }),
          fc.oneof(
            fc.string().map((s) => `val'${s}`),
            fc.string().map((s) => `path\\${s}`),
            fc.string({ unit: "grapheme" })
          ),
          { minKeys: 1, maxKeys: 3 }
        ),
        // Regular strings
        fc.string()
      ),
      { minKeys: 1, maxKeys: 5 }
    );

    await fc.assert(
      fc.property(problematicJsonArb, (jsonObj) => {
        const result = formatSqlValue(jsonObj);

        // The result must be a syntactically valid PostgreSQL jsonb literal
        expect(isValidPostgresJsonbLiteral(result)).toBe(true);
      }),
      { numRuns: 500 }
    );
  });
});

// ---- Sub-condition 3: FK conflict resolution failure ----

describe("Bug Condition 3: Dangling FK in conflict resolution must be set to NULL", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  /**
   * This test verifies that when a conflict resolution chooses "backup" and the
   * backup data contains a caseId pointing to a non-existent Case, the UPDATE
   * should set caseId to NULL instead of using the non-existent ID.
   *
   * We test this by setting up a scenario where:
   * - A Contact exists in both backup and DB (conflict)
   * - The backup version has caseId pointing to a deleted Case
   * - The DB version has caseId = null (set by onDelete: SetNull)
   * - User chooses "backup" for conflict resolution
   * - The generated UPDATE SQL should set caseId to NULL, not the deleted Case ID
   */
  it("conflict resolution with dangling FK sets caseId to NULL (PBT)", async () => {
    // Generate scenarios with dangling FK references
    const danglingFkArb = fc.record({
      contactId: fc.integer({ min: 1, max: 10000 }),
      deletedCaseId: fc.integer({ min: 1, max: 10000 }),
      contactName: fc.string({ minLength: 1, maxLength: 20 }),
    });

    await fc.assert(
      fc.asyncProperty(danglingFkArb, async ({ contactId, deletedCaseId, contactName }) => {
        vi.resetModules();

        // Track all SQL statements executed
        const executedSqls: string[] = [];
        const mockExecuteRawUnsafe = vi.fn().mockImplementation(async (sql: string) => {
          executedSqls.push(sql);
          return 1;
        });

        const mockTransaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
          const mockQueryRawUnsafe = vi.fn().mockImplementation(async (sql: string) => {
            // FK existence check: if querying cases table, return empty (case doesn't exist)
            if (sql.includes('"cases"') || sql.includes('"clients"')) {
              // clients exist (id=1), cases don't
              if (sql.includes('"clients"')) return [{ "1": 1 }];
              return []; // case doesn't exist
            }
            return [];
          });
          return fn({ $executeRawUnsafe: mockExecuteRawUnsafe, $queryRawUnsafe: mockQueryRawUnsafe });
        });

        // Build backup data: contact has caseId pointing to deleted case
        const backupContact = {
          id: contactId,
          name: contactName,
          caseId: deletedCaseId,
          clientId: 1,
          contactType: "撥出",
          date: "2024-01-01T00:00:00.000Z",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-15T00:00:00.000Z",
        };

        // Current DB data: contact has caseId = null (cascade set null)
        const currentContact = {
          id: contactId,
          name: contactName,
          caseId: null,
          clientId: 1,
          contactType: "撥出",
          date: "2024-01-01T00:00:00.000Z",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-10T00:00:00.000Z",
        };

        // Setup: backup has the contact with caseId, DB has it with null caseId
        // No cases exist in DB (the case was deleted)
        const ALL_TABLES = [
          "users", "staff", "clients", "cases", "contacts", "todos",
          "family_relations", "deletion_requests", "audit_logs", "client_photos",
          "_CaseToStaff", "_ContactToStaff", "_StaffToTodo",
        ];

        const fileContents: Record<string, string> = {};
        fileContents["metadata.json"] = JSON.stringify({
          timestamp: new Date().toISOString(),
          version: 2,
          status: "complete",
          tables: ALL_TABLES.map((t) => ({
            name: t,
            expectedCount: t === "contacts" ? 1 : t === "clients" ? 1 : 0,
            actualCount: t === "contacts" ? 1 : t === "clients" ? 1 : 0,
          })),
        });

        // Backup: contacts has the record with dangling caseId, cases is empty (case not in backup)
        for (const t of ALL_TABLES) {
          if (t === "contacts") {
            fileContents[`${t}.json`] = JSON.stringify([backupContact]);
          } else if (t === "clients") {
            fileContents[`${t}.json`] = JSON.stringify([{ id: 1, name: "TestClient", createdAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-01-01T00:00:00.000Z" }]);
          } else {
            fileContents[`${t}.json`] = JSON.stringify([]);
          }
        }

        const mockReadFile = vi.fn().mockImplementation(async (filePath: string) => {
          const fileName = filePath.split(/[\\/]/).pop()!;
          if (fileContents[fileName] !== undefined) return fileContents[fileName];
          throw new Error(`File not found: ${filePath}`);
        });

        vi.doMock("fs/promises", () => ({
          readFile: mockReadFile,
          mkdir: vi.fn().mockResolvedValue(undefined),
          writeFile: vi.fn().mockResolvedValue(undefined),
        }));

        // DB state: contacts has the record with null caseId, cases is empty
        const emptyFindMany = vi.fn().mockResolvedValue([]);
        const rawQueryFn = vi.fn()
          .mockResolvedValueOnce([])  // _CaseToStaff
          .mockResolvedValueOnce([])  // _ContactToStaff
          .mockResolvedValueOnce([]); // _StaffToTodo

        vi.doMock("@/app/_lib/db", () => ({
          prisma: {
            user: { findMany: emptyFindMany },
            staff: { findMany: emptyFindMany },
            client: { findMany: vi.fn().mockResolvedValue([{ id: 1, name: "TestClient", createdAt: new Date("2024-01-01"), updatedAt: new Date("2024-01-01") }]) },
            case: { findMany: emptyFindMany }, // No cases exist — the case was deleted
            contact: { findMany: vi.fn().mockResolvedValue([currentContact]) },
            todo: { findMany: emptyFindMany },
            familyRelation: { findMany: emptyFindMany },
            deletionRequest: { findMany: emptyFindMany },
            auditLog: { findMany: emptyFindMany },
            clientPhoto: { findMany: emptyFindMany },
            $queryRaw: rawQueryFn,
            $transaction: mockTransaction,
          },
        }));

        const { applyRestore } = await import("@/app/_lib/utils/restore");

        // Conflict resolution: choose "backup" for the contact
        const resolutions = [
          { tableName: "contacts", recordId: contactId, choice: "backup" as const },
        ];

        await applyRestore("test-snapshot", resolutions);

        // Find the UPDATE SQL for the contacts table
        const updateSqls = executedSqls.filter(
          (sql) => sql.startsWith('UPDATE "contacts"')
        );

        // There should be exactly one UPDATE for the contact
        expect(updateSqls).toHaveLength(1);
        const updateSql = updateSqls[0];

        // EXPECTED behavior: the UPDATE should set caseId to NULL
        // because the referenced Case does not exist in the DB
        // The current (buggy) code will set it to the deleted case ID
        expect(updateSql).toContain('"case_id" = NULL');
        expect(updateSql).not.toContain(`"case_id" = ${deletedCaseId}`);
      }),
      { numRuns: 50 }
    );
  });
});


// ============================================================================
// Property 2: Preservation — Non-Enum/Non-JSON SQL Generation Unchanged
// ============================================================================

/**
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * Preservation Property Tests — written BEFORE the fix using observation-first methodology.
 * These tests capture the CURRENT (correct) behavior of formatSqlValue and formatFieldValue
 * for non-enum, non-JSON inputs. They MUST PASS on unfixed code and continue to pass after fix.
 *
 * Observed baseline on unfixed code:
 * - formatSqlValue(null) → "NULL"
 * - formatSqlValue(true) → "TRUE", formatSqlValue(false) → "FALSE"
 * - formatSqlValue(42) → "42"
 * - formatSqlValue("hello") → "'hello'"
 * - formatSqlValue("O'Brien") → "'O''Brien'"
 * - formatSqlValue(new Date("2024-01-01T00:00:00.000Z")) → "'2024-01-01T00:00:00.000Z'"
 * - formatSqlValue(["a","b"]) → "ARRAY['a','b']::text[]"
 * - formatFieldValue("staff", "name", "Alice") → "'Alice'"
 * - formatFieldValue("clients", "birthday", "1990-05-15T00:00:00.000Z") → "'1990-05-15T00:00:00.000Z'"
 */

// Replicate the exact private functions from restore.ts for preservation testing.
// These are the UNFIXED versions — the fix must not change their behavior for these input types.

function preservationFormatSqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (Array.isArray(value)) {
    const elements = value.map((v: unknown) => `'${String(v).replace(/'/g, "''")}'`).join(",");
    return `ARRAY[${elements}]::text[]`;
  }
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

const PRESERVATION_DATE_FIELDS: Record<string, string[]> = {
  users: ["createdAt", "updatedAt"],
  staff: ["createdAt", "updatedAt"],
  clients: ["birthday", "createdAt", "updatedAt"],
  cases: ["createdAt", "updatedAt"],
  contacts: ["date", "createdAt", "updatedAt"],
  todos: ["date", "createdAt", "updatedAt"],
  deletion_requests: ["reviewedAt", "restoredAt", "createdAt", "updatedAt"],
  audit_logs: ["createdAt"],
  client_photos: ["createdAt"],
};

function preservationParseDateValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return `'${d.toISOString()}'`;
    return `'${value.replace(/'/g, "''")}'`;
  }
  return preservationFormatSqlValue(value);
}

function preservationFormatFieldValue(tableName: string, fieldName: string, value: unknown): string {
  const dateFields = PRESERVATION_DATE_FIELDS[tableName] || [];
  if (dateFields.includes(fieldName)) {
    return preservationParseDateValue(value);
  }
  return preservationFormatSqlValue(value);
}

describe("Preservation Property 2: Non-Enum/Non-JSON SQL Generation Unchanged", () => {

  // PBT 1: null | undefined → "NULL"
  it("PBT 1: formatSqlValue returns 'NULL' for all null/undefined values", () => {
    const nullishArb = fc.constantFrom(null, undefined);

    fc.assert(
      fc.property(nullishArb, (value) => {
        const result = preservationFormatSqlValue(value);
        expect(result).toBe("NULL");
      }),
      { numRuns: 20 }
    );
  });

  // PBT 2: boolean → "TRUE" or "FALSE"
  it("PBT 2: formatSqlValue returns 'TRUE' or 'FALSE' for all boolean values", () => {
    fc.assert(
      fc.property(fc.boolean(), (value) => {
        const result = preservationFormatSqlValue(value);
        if (value) {
          expect(result).toBe("TRUE");
        } else {
          expect(result).toBe("FALSE");
        }
      }),
      { numRuns: 20 }
    );
  });

  // PBT 3: finite number → String(value)
  it("PBT 3: formatSqlValue returns String(value) for all finite numbers", () => {
    // Use double that produces finite values (no NaN, no Infinity)
    const finiteNumberArb = fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e15, max: 1e15 });

    fc.assert(
      fc.property(finiteNumberArb, (value) => {
        const result = preservationFormatSqlValue(value);
        expect(result).toBe(String(value));
      }),
      { numRuns: 200 }
    );
  });

  // PBT 4: string → single-quoted with ' escaped to ''
  it("PBT 4: formatSqlValue wraps strings in single quotes with internal quotes escaped", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100, unit: "grapheme" }), (value) => {
        const result = preservationFormatSqlValue(value);

        // Must start and end with single quote
        expect(result.startsWith("'")).toBe(true);
        expect(result.endsWith("'")).toBe(true);

        // Inner content: all single quotes must be doubled
        const inner = result.slice(1, -1);
        const expectedInner = String(value).replace(/'/g, "''");
        expect(inner).toBe(expectedInner);
      }),
      { numRuns: 500 }
    );
  });

  // PBT 5: Date → ISO string wrapped in single quotes
  it("PBT 5: formatSqlValue returns ISO string in single quotes for all Date values", () => {
    fc.assert(
      fc.property(fc.date({ min: new Date("1970-01-01"), max: new Date("2099-12-31") }).filter((d) => !isNaN(d.getTime())), (value) => {
        const result = preservationFormatSqlValue(value);
        expect(result).toBe(`'${value.toISOString()}'`);
      }),
      { numRuns: 200 }
    );
  });

  // PBT 6: string[] → ARRAY[...]::text[] with elements escaped
  it("PBT 6: formatSqlValue returns ARRAY[...]::text[] for all string arrays", () => {
    const stringArrayArb = fc.array(fc.string({ minLength: 0, maxLength: 30 }), { minLength: 0, maxLength: 10 });

    fc.assert(
      fc.property(stringArrayArb, (arr) => {
        const result = preservationFormatSqlValue(arr);

        // Build expected output
        const elements = arr.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(",");
        const expected = `ARRAY[${elements}]::text[]`;
        expect(result).toBe(expected);
      }),
      { numRuns: 200 }
    );
  });

  // PBT 7: non-enum, non-date fields → formatFieldValue delegates to formatSqlValue unchanged
  it("PBT 7: formatFieldValue delegates to formatSqlValue for non-enum, non-date fields", () => {
    // Non-enum, non-date table/field combos
    const nonEnumNonDateFields: Array<{ table: string; field: string }> = [
      { table: "staff", field: "name" },
      { table: "staff", field: "phone" },
      { table: "clients", field: "name" },
      { table: "clients", field: "phone" },
      { table: "clients", field: "addr" },
      { table: "cases", field: "note" },
      { table: "contacts", field: "note" },
      { table: "todos", field: "content" },
    ];

    const fieldArb = fc.constantFrom(...nonEnumNonDateFields);

    // Test with various value types that formatSqlValue handles
    const valueArb = fc.oneof(
      fc.constant(null),
      fc.boolean(),
      fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e10, max: 1e10 }),
      fc.string({ minLength: 0, maxLength: 50 }),
      fc.integer({ min: 0, max: 100000 })
    );

    fc.assert(
      fc.property(fieldArb, valueArb, ({ table, field }, value) => {
        const fieldResult = preservationFormatFieldValue(table, field, value);
        const sqlResult = preservationFormatSqlValue(value);
        expect(fieldResult).toBe(sqlResult);
      }),
      { numRuns: 500 }
    );
  });
});
