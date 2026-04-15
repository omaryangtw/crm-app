/**
 * Integration tests for critical flows.
 *
 * These tests compose multiple pure functions together to verify
 * end-to-end logic without a real database connection.
 *
 * **Validates: Requirements 1.1, 2.1, 3.1, 4.4, 24.1**
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcrypt";
import Papa from "papaparse";
import { registerSchema, loginSchema } from "@/app/_lib/schemas/auth-schema";
import {
  buildExportWhereClause,
  projectColumns,
  generateCsv,
  EXPORT_PRESETS,
} from "@/app/_lib/utils/export-utils";
import type { ExportQuery } from "@/app/_lib/schemas/export-schema";

// ---------------------------------------------------------------------------
// 1. Auth validation flow
//    registerSchema validates → password hashed → loginSchema validates
// ---------------------------------------------------------------------------
describe("Integration: Auth validation flow", () => {
  it("register → hash → login schema validates the full pipeline", async () => {
    const input = { email: "user@example.com", password: "Abc12345" };

    // Step 1: registerSchema accepts valid input
    const regResult = registerSchema.safeParse(input);
    expect(regResult.success).toBe(true);

    // Step 2: password would be hashed (simulating the server action)
    const hash = await bcrypt.hash(input.password, 4);
    expect(hash).not.toBe(input.password);
    expect(await bcrypt.compare(input.password, hash)).toBe(true);

    // Step 3: loginSchema accepts the same credentials for login
    const loginResult = loginSchema.safeParse(input);
    expect(loginResult.success).toBe(true);
  });

  it("registerSchema rejects invalid email, loginSchema still validates structure", () => {
    const badEmail = { email: "not-an-email", password: "Abc12345" };
    expect(registerSchema.safeParse(badEmail).success).toBe(false);

    // loginSchema only requires non-empty password and valid email format
    expect(loginSchema.safeParse(badEmail).success).toBe(false);
  });

  it("registerSchema rejects weak passwords while loginSchema is lenient", () => {
    const shortPw = { email: "user@example.com", password: "Ab1" };
    expect(registerSchema.safeParse(shortPw).success).toBe(false);

    // loginSchema only requires min 1 char — it doesn't enforce strength
    expect(loginSchema.safeParse(shortPw).success).toBe(true);
  });

  it("registerSchema rejects non-alphanumeric passwords", () => {
    const specialChar = { email: "user@example.com", password: "Pass!@#$" };
    expect(registerSchema.safeParse(specialChar).success).toBe(false);
  });

  it("hashed password is never recoverable from hash", async () => {
    const password = "SecurePass1";
    const hash = await bcrypt.hash(password, 4);

    // Hash doesn't contain the plaintext
    expect(hash).not.toContain(password);
    // Wrong password fails comparison
    expect(await bcrypt.compare("WrongPass1", hash)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Export pipeline
//    buildExportWhereClause → projectColumns → generateCsv → Papa.parse
// ---------------------------------------------------------------------------
describe("Integration: Export pipeline end-to-end", () => {
  const sampleClients: Record<string, unknown>[] = [
    {
      name: "Alice",
      city: "臺南市",
      dist: "東區",
      vill: "大學里",
      addr: "大學路1號",
      mobile: "0912345678",
      isDead: false,
      canMail: true,
      canCall: true,
      householdAdmin: true,
      plainMountain: "plain",
      sex: "female",
      note: "test note",
    },
    {
      name: "Bob",
      city: "臺南市",
      dist: "南區",
      vill: "明德里",
      addr: "中華路2號",
      mobile: "0987654321",
      isDead: false,
      canMail: true,
      canCall: false,
      householdAdmin: false,
      plainMountain: "plain",
      sex: "male",
      note: null,
    },
    {
      name: "Charlie",
      city: "高雄市",
      dist: "前鎮區",
      vill: null,
      addr: null,
      mobile: null,
      isDead: true,
      canMail: false,
      canCall: false,
      householdAdmin: false,
      plainMountain: "mountain",
      sex: "male",
      note: null,
    },
  ];

  // Simulate applying a Prisma WHERE clause to in-memory data
  function applyWhereClause(
    data: Record<string, unknown>[],
    where: Record<string, unknown>
  ): Record<string, unknown>[] {
    if (!where.AND) return data;
    const conditions = where.AND as Record<string, unknown>[];

    return data.filter((record) =>
      conditions.every((cond) => {
        const [key, value] = Object.entries(cond)[0];
        if (typeof value === "boolean" || typeof value === "string") {
          return record[key] === value;
        }
        if (value && typeof value === "object" && "not" in value) {
          return record[key] != null;
        }
        if (value && typeof value === "object" && "contains" in value) {
          const v = value as { contains: string; mode: string };
          const field = String(record[key] ?? "");
          return field.toLowerCase().includes(v.contains.toLowerCase());
        }
        return true; // skip complex conditions like date ranges
      })
    );
  }

  it("filters → projects → CSV → parse round-trip for household mailing preset", () => {
    const preset = EXPORT_PRESETS.householdMailing;
    const where = buildExportWhereClause(preset.filters as ExportQuery);

    // Apply filter
    const filtered = applyWhereClause(sampleClients, where);
    // Only Alice matches: isDead=false, canMail=true, householdAdmin=true, plainMountain=plain, city contains 臺南市
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("Alice");

    // Project columns
    const columns = [...preset.columns];
    const projected = projectColumns(filtered, columns);
    expect(Object.keys(projected[0]).sort()).toEqual(columns.sort());

    // Generate CSV and parse back
    const csv = generateCsv(filtered, columns);
    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
    });

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].name).toBe("Alice");
    expect(parsed.data[0].city).toBe("臺南市");
    expect(parsed.data[0].addr).toBe("大學路1號");
  });

  it("filters → projects → CSV → parse round-trip for SMS list preset", () => {
    const preset = EXPORT_PRESETS.smsList;
    const where = buildExportWhereClause(preset.filters as ExportQuery);

    const filtered = applyWhereClause(sampleClients, where);
    // Alice: isDead=false, canCall=true, plainMountain=plain ✓
    // Bob: isDead=false, canCall=false ✗
    // Charlie: isDead=true ✗
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("Alice");

    const columns = [...preset.columns];
    const csv = generateCsv(filtered, columns);
    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
    });

    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0].name).toBe("Alice");
    expect(parsed.data[0].mobile).toBe("0912345678");
  });

  it("custom filter with multiple criteria composes correctly", () => {
    const query: ExportQuery = {
      isDead: false,
      canMail: true,
      city: "臺南",
    };
    const where = buildExportWhereClause(query);
    const filtered = applyWhereClause(sampleClients, where);

    // Alice and Bob both match isDead=false, canMail=true, city contains 臺南
    expect(filtered).toHaveLength(2);

    const columns = ["name", "city", "mobile"];
    const projected = projectColumns(filtered, columns);

    // Each row should only have the 3 selected columns
    for (const row of projected) {
      expect(Object.keys(row).sort()).toEqual(columns.sort());
    }

    const csv = generateCsv(filtered, columns);
    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
    });

    expect(parsed.data).toHaveLength(2);
    expect(parsed.data.map((r) => r.name).sort()).toEqual(["Alice", "Bob"]);
  });

  it("empty filter returns all records (empty WHERE clause)", () => {
    const where = buildExportWhereClause({});
    expect(where).toEqual({});

    // With no conditions, all records pass
    const columns = ["name"];
    const csv = generateCsv(sampleClients, columns);
    const parsed = Papa.parse<Record<string, string>>(csv, {
      header: true,
      skipEmptyLines: true,
    });
    expect(parsed.data).toHaveLength(3);
  });

  it("sex filter composes with boolean filters", () => {
    const query: ExportQuery = { isDead: false, sex: "female" };
    const where = buildExportWhereClause(query);
    const filtered = applyWhereClause(sampleClients, where);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("Alice");
  });
});

// ---------------------------------------------------------------------------
// 3. Backup file structure
//    Test that runBackup creates the expected directory and JSON files
// ---------------------------------------------------------------------------
describe("Integration: Backup file structure", () => {
  // We mock fs and prisma to test the backup logic composition
  const mockMkdir = vi.fn().mockResolvedValue(undefined);
  const mockWriteFile = vi.fn().mockResolvedValue(undefined);

  const mockClients = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ];
  const mockCases = [{ id: 1, name: "Case A", clientId: 1 }];
  const mockContacts = [{ id: 1, record: "Called Alice", clientId: 1 }];
  const mockFamilyRelations = [
    { id: 1, personAId: 1, personBId: 2, relationAToB: "兄", relationBToA: "弟" },
  ];
  const mockUsers = [
    { id: 1, email: "admin@test.com", role: "admin", staffId: null, createdAt: new Date(), updatedAt: new Date() },
  ];

  /** Helper: build a full prisma mock with all 13 tables */
  function buildPrismaMock(overrides: Record<string, unknown> = {}) {
    return {
      user: { findMany: vi.fn().mockResolvedValue(overrides.users ?? mockUsers) },
      staff: { findMany: vi.fn().mockResolvedValue(overrides.staff ?? []) },
      client: { findMany: vi.fn().mockResolvedValue(overrides.clients ?? mockClients) },
      case: { findMany: vi.fn().mockResolvedValue(overrides.cases ?? mockCases) },
      contact: { findMany: vi.fn().mockResolvedValue(overrides.contacts ?? mockContacts) },
      todo: { findMany: vi.fn().mockResolvedValue(overrides.todos ?? []) },
      familyRelation: { findMany: vi.fn().mockResolvedValue(overrides.familyRelations ?? mockFamilyRelations) },
      deletionRequest: { findMany: vi.fn().mockResolvedValue(overrides.deletionRequests ?? []) },
      auditLog: { findMany: vi.fn().mockResolvedValue(overrides.auditLogs ?? []) },
      clientPhoto: { findMany: vi.fn().mockResolvedValue(overrides.clientPhotos ?? []) },
      $queryRaw: vi.fn().mockResolvedValue(overrides.rawQuery ?? []),
    };
  }

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("creates timestamped directory with 13 table JSON files + metadata.json", async () => {
    vi.doMock("fs/promises", () => ({
      mkdir: mockMkdir,
      writeFile: mockWriteFile,
    }));

    vi.doMock("@/app/_lib/db", () => ({ prisma: buildPrismaMock() }));

    const { runBackup } = await import("@/app/_lib/utils/backup");
    const result = await runBackup();

    // mkdir should be called once with recursive: true
    expect(mockMkdir).toHaveBeenCalledTimes(1);
    const dirPath = mockMkdir.mock.calls[0][0] as string;
    expect(dirPath).toMatch(/backups[\\/]\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/);
    expect(mockMkdir.mock.calls[0][1]).toEqual({ recursive: true });

    // writeFile: 13 table JSON files + 1 metadata.json = 14
    expect(mockWriteFile).toHaveBeenCalledTimes(14);

    const writtenFiles = mockWriteFile.mock.calls.map(
      (call) => (call[0] as string).split(/[\\/]/).pop()
    );
    expect(writtenFiles).toContain("metadata.json");
    expect(writtenFiles).toContain("clients.json");
    expect(writtenFiles).toContain("users.json");
    expect(writtenFiles).toContain("_CaseToStaff.json");

    // Result should contain snapshotName and metadata
    expect(result.snapshotName).toMatch(/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/);
    expect(result.metadata.status).toBe("complete");
    expect(result.metadata.version).toBe(2);
    expect(result.metadata.tables).toHaveLength(13);
  });

  it("writes correct JSON content for each table", async () => {
    vi.doMock("fs/promises", () => ({
      mkdir: mockMkdir,
      writeFile: mockWriteFile,
    }));

    vi.doMock("@/app/_lib/db", () => ({ prisma: buildPrismaMock() }));

    const { runBackup } = await import("@/app/_lib/utils/backup");
    await runBackup();

    // Verify JSON content for clients
    const clientsCall = mockWriteFile.mock.calls.find((call) =>
      (call[0] as string).endsWith("clients.json")
    );
    expect(clientsCall).toBeDefined();
    const clientsJson = JSON.parse(clientsCall![1] as string);
    expect(clientsJson).toEqual(mockClients);

    // Verify JSON content for cases
    const casesCall = mockWriteFile.mock.calls.find((call) =>
      (call[0] as string).endsWith("cases.json")
    );
    expect(casesCall).toBeDefined();
    const casesJson = JSON.parse(casesCall![1] as string);
    expect(casesJson).toEqual(mockCases);

    // Verify JSON content for family_relations
    const relationsCall = mockWriteFile.mock.calls.find((call) =>
      (call[0] as string).endsWith("family_relations.json")
    );
    expect(relationsCall).toBeDefined();
    const relationsJson = JSON.parse(relationsCall![1] as string);
    expect(relationsJson).toEqual(mockFamilyRelations);
  });

  it("records error in metadata when a table query fails (does not throw)", async () => {
    vi.doMock("fs/promises", () => ({
      mkdir: mockMkdir,
      writeFile: mockWriteFile,
    }));

    const prismaMock = buildPrismaMock();
    prismaMock.client.findMany = vi.fn().mockRejectedValue(new Error("DB connection lost"));
    vi.doMock("@/app/_lib/db", () => ({ prisma: prismaMock }));

    const { runBackup } = await import("@/app/_lib/utils/backup");
    const result = await runBackup();

    // Should NOT throw — per-table error handling continues
    expect(result.metadata.status).toBe("partial");
    expect(result.metadata.errors).toBeDefined();
    expect(result.metadata.errors!.some((e) => e.table === "clients")).toBe(true);
    expect(result.metadata.errors![0].error).toContain("DB connection lost");
  });

  it("uses BACKUP_DIR env variable for directory path", async () => {
    const originalEnv = process.env.BACKUP_DIR;
    process.env.BACKUP_DIR = "/custom/backup/path";

    vi.doMock("fs/promises", () => ({
      mkdir: mockMkdir,
      writeFile: mockWriteFile,
    }));

    vi.doMock("@/app/_lib/db", () => ({ prisma: buildPrismaMock() }));

    const { runBackup } = await import("@/app/_lib/utils/backup");
    await runBackup();

    const dirPath = mockMkdir.mock.calls[0][0] as string;
    expect(dirPath).toMatch(/^\/custom\/backup\/path[\\/]/);

    // Restore
    if (originalEnv !== undefined) {
      process.env.BACKUP_DIR = originalEnv;
    } else {
      delete process.env.BACKUP_DIR;
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Cascade delete verification (schema-level)
//    Verify the Prisma schema has onDelete: Cascade configured correctly
//    Uses readFileSync from node:fs to avoid conflict with mocked fs/promises
// ---------------------------------------------------------------------------
import { readFileSync } from "node:fs";

describe("Integration: Cascade delete schema verification", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf-8");

  it("Prisma schema defines cascade delete from Client to Case", () => {
    const caseModel = schema.slice(
      schema.indexOf("model Case"),
      schema.indexOf("@@map(\"cases\")")
    );
    expect(caseModel).toContain("onDelete: Cascade");
  });

  it("Prisma schema defines cascade delete from Client to Contact", () => {
    const contactModel = schema.slice(
      schema.indexOf("model Contact"),
      schema.indexOf("@@map(\"contacts\")")
    );
    expect(contactModel).toContain("onDelete: Cascade");
  });

  it("Prisma schema defines cascade delete from Client to Todo", () => {
    const todoModel = schema.slice(
      schema.indexOf("model Todo"),
      schema.indexOf("@@map(\"todos\")")
    );
    expect(todoModel).toContain("onDelete: Cascade");
  });

  it("Prisma schema defines cascade delete from Client to FamilyRelation", () => {
    const familyModel = schema.slice(
      schema.indexOf("model FamilyRelation"),
      schema.indexOf("@@map(\"family_relations\")")
    );
    // Both personA and personB relations should cascade
    const cascadeCount = (familyModel.match(/onDelete: Cascade/g) || []).length;
    expect(cascadeCount).toBe(2);
  });
});
