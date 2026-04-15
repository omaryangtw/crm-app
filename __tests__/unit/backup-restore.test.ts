import { describe, it, expect, vi, beforeEach } from "vitest";
import fc from "fast-check";

/**
 * **Validates: Requirements 1.1, 1.2, 1.4, 2.1, 2.4**
 *
 * Property 1: Backup produces complete snapshot
 *
 * For any database state with arbitrary records across all 13 tables,
 * running runBackup() SHALL produce a Backup_Snapshot directory containing
 * one JSON file per table in Full_Table_Set, and a metadata.json file whose
 * tables array lists all 13 tables with expectedCount and actualCount
 * matching the actual number of records exported.
 */
describe("Feature: backup-restore, Property 1: Backup produces complete snapshot", () => {
  const ALL_TABLE_NAMES = [
    "users",
    "staff",
    "clients",
    "cases",
    "contacts",
    "todos",
    "family_relations",
    "deletion_requests",
    "audit_logs",
    "client_photos",
    "_CaseToStaff",
    "_ContactToStaff",
    "_StaffToTodo",
  ] as const;

  const mockMkdir = vi.fn().mockResolvedValue(undefined);
  const mockWriteFile = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  /** Generate fake records for a given count */
  function makeFakeRecords(count: number): Record<string, unknown>[] {
    return Array.from({ length: count }, (_, i) => ({ id: i + 1 }));
  }

  /** Build a prisma mock where each table returns `counts[tableName]` records */
  function buildPrismaMock(counts: Record<string, number>) {
    const rawQueryFn = vi.fn();
    // $queryRaw is called for implicit tables in order: _CaseToStaff, _ContactToStaff, _StaffToTodo
    rawQueryFn
      .mockResolvedValueOnce(makeFakeRecords(counts["_CaseToStaff"] ?? 0))
      .mockResolvedValueOnce(makeFakeRecords(counts["_ContactToStaff"] ?? 0))
      .mockResolvedValueOnce(makeFakeRecords(counts["_StaffToTodo"] ?? 0));

    return {
      user: { findMany: vi.fn().mockResolvedValue(makeFakeRecords(counts["users"] ?? 0)) },
      staff: { findMany: vi.fn().mockResolvedValue(makeFakeRecords(counts["staff"] ?? 0)) },
      client: { findMany: vi.fn().mockResolvedValue(makeFakeRecords(counts["clients"] ?? 0)) },
      case: { findMany: vi.fn().mockResolvedValue(makeFakeRecords(counts["cases"] ?? 0)) },
      contact: { findMany: vi.fn().mockResolvedValue(makeFakeRecords(counts["contacts"] ?? 0)) },
      todo: { findMany: vi.fn().mockResolvedValue(makeFakeRecords(counts["todos"] ?? 0)) },
      familyRelation: { findMany: vi.fn().mockResolvedValue(makeFakeRecords(counts["family_relations"] ?? 0)) },
      deletionRequest: { findMany: vi.fn().mockResolvedValue(makeFakeRecords(counts["deletion_requests"] ?? 0)) },
      auditLog: { findMany: vi.fn().mockResolvedValue(makeFakeRecords(counts["audit_logs"] ?? 0)) },
      clientPhoto: { findMany: vi.fn().mockResolvedValue(makeFakeRecords(counts["client_photos"] ?? 0)) },
      $queryRaw: rawQueryFn,
    };
  }

  it("all 13 tables have JSON files, metadata.json exists with 13 tables, counts match", async () => {
    // Arbitrary that generates a record count (0–50) for each of the 13 tables
    const tableCountsArb = fc.record(
      Object.fromEntries(ALL_TABLE_NAMES.map((name) => [name, fc.integer({ min: 0, max: 50 })]))
    ) as fc.Arbitrary<Record<string, number>>;

    await fc.assert(
      fc.asyncProperty(tableCountsArb, async (counts) => {
        // Reset mocks per iteration
        vi.resetModules();
        mockMkdir.mockClear();
        mockWriteFile.mockClear();

        vi.doMock("fs/promises", () => ({
          mkdir: mockMkdir,
          writeFile: mockWriteFile,
        }));

        vi.doMock("@/app/_lib/db", () => ({
          prisma: buildPrismaMock(counts),
        }));

        const { runBackup } = await import("@/app/_lib/utils/backup");
        const result = await runBackup();

        // --- Collect written file names ---
        const writtenFiles = mockWriteFile.mock.calls.map(
          (call) => (call[0] as string).split(/[\\/]/).pop()!
        );

        // 1) Every table has a corresponding JSON file
        for (const tableName of ALL_TABLE_NAMES) {
          expect(writtenFiles).toContain(`${tableName}.json`);
        }

        // 2) metadata.json exists
        expect(writtenFiles).toContain("metadata.json");

        // 3) Total writes = 13 table files + 1 metadata = 14
        expect(mockWriteFile).toHaveBeenCalledTimes(14);

        // --- Verify metadata ---
        const metadataCall = mockWriteFile.mock.calls.find((call) =>
          (call[0] as string).endsWith("metadata.json")
        );
        expect(metadataCall).toBeDefined();
        const metadata = JSON.parse(metadataCall![1] as string);

        // 4) metadata.tables has exactly 13 entries
        expect(metadata.tables).toHaveLength(13);

        // 5) Each table's actualCount and expectedCount match the generated count
        for (const tableName of ALL_TABLE_NAMES) {
          const tableInfo = metadata.tables.find(
            (t: { name: string }) => t.name === tableName
          );
          expect(tableInfo).toBeDefined();
          expect(tableInfo.expectedCount).toBe(counts[tableName]);
          expect(tableInfo.actualCount).toBe(counts[tableName]);
        }

        // 6) Status should be "complete" (no failures)
        expect(metadata.status).toBe("complete");

        // 7) Result object matches metadata
        expect(result.metadata.tables).toHaveLength(13);
        expect(result.metadata.status).toBe("complete");

        // 8) Verify each table's JSON content has the correct number of records
        for (const tableName of ALL_TABLE_NAMES) {
          const tableCall = mockWriteFile.mock.calls.find((call) =>
            (call[0] as string).endsWith(`${tableName}.json`)
          );
          expect(tableCall).toBeDefined();
          const tableData = JSON.parse(tableCall![1] as string);
          expect(tableData).toHaveLength(counts[tableName]);
        }
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Validates: Requirements 1.3**
 *
 * Property 2: User backup excludes password
 *
 * For any set of user records in the database, the exported users.json
 * SHALL contain all user fields except password. Specifically, for every
 * record in the exported JSON, the set of keys SHALL NOT include password,
 * and SHALL include id, email, role, staffId, createdAt, updatedAt.
 */
describe("Feature: backup-restore, Property 2: User backup excludes password", () => {
  const mockMkdir = vi.fn().mockResolvedValue(undefined);
  const mockWriteFile = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  /** Arbitrary for a single user record (simulating what Prisma select returns — no password) */
  const userRecordArb = fc.record({
    id: fc.integer({ min: 1, max: 100000 }),
    email: fc.emailAddress(),
    role: fc.constantFrom("admin", "user"),
    staffId: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
    createdAt: fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }),
    updatedAt: fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }),
  });

  /** Build a minimal prisma mock — only users table matters for this property */
  function buildPrismaMock(users: Record<string, unknown>[]) {
    const emptyFindMany = vi.fn().mockResolvedValue([]);
    const rawQueryFn = vi.fn().mockResolvedValue([]);

    return {
      user: { findMany: vi.fn().mockResolvedValue(users) },
      staff: { findMany: emptyFindMany },
      client: { findMany: emptyFindMany },
      case: { findMany: emptyFindMany },
      contact: { findMany: emptyFindMany },
      todo: { findMany: emptyFindMany },
      familyRelation: { findMany: emptyFindMany },
      deletionRequest: { findMany: emptyFindMany },
      auditLog: { findMany: emptyFindMany },
      clientPhoto: { findMany: emptyFindMany },
      $queryRaw: rawQueryFn,
    };
  }

  const REQUIRED_FIELDS = ["id", "email", "role", "staffId", "createdAt", "updatedAt"] as const;

  it("exported users.json never contains password and always contains required fields", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(userRecordArb, { minLength: 1, maxLength: 30 }),
        async (users) => {
          vi.resetModules();
          mockMkdir.mockClear();
          mockWriteFile.mockClear();

          vi.doMock("fs/promises", () => ({
            mkdir: mockMkdir,
            writeFile: mockWriteFile,
          }));

          vi.doMock("@/app/_lib/db", () => ({
            prisma: buildPrismaMock(users),
          }));

          const { runBackup } = await import("@/app/_lib/utils/backup");
          await runBackup();

          // Find the users.json write call
          const usersCall = mockWriteFile.mock.calls.find((call) =>
            (call[0] as string).endsWith("users.json")
          );
          expect(usersCall).toBeDefined();

          const exportedUsers: Record<string, unknown>[] = JSON.parse(usersCall![1] as string);

          // Verify count matches
          expect(exportedUsers).toHaveLength(users.length);

          // For every exported record: no password, all required fields present
          for (const record of exportedUsers) {
            expect(record).not.toHaveProperty("password");
            for (const field of REQUIRED_FIELDS) {
              expect(record).toHaveProperty(field);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Validates: Requirements 2.2, 2.3**
 *
 * Property 3: Metadata status reflects backup outcome
 *
 * For any backup execution where a random subset of tables fails to export,
 * the metadata.json status SHALL be "partial" if at least one table failed,
 * and "complete" if all tables succeeded. When status is "partial", the
 * errors array SHALL contain entries for exactly the failed tables.
 */
describe("Feature: backup-restore, Property 3: Metadata status reflects backup outcome", () => {
  const ALL_TABLE_NAMES = [
    "users",
    "staff",
    "clients",
    "cases",
    "contacts",
    "todos",
    "family_relations",
    "deletion_requests",
    "audit_logs",
    "client_photos",
    "_CaseToStaff",
    "_ContactToStaff",
    "_StaffToTodo",
  ] as const;

  /** Model table names that use prisma.<model>.findMany() */
  const MODEL_TABLES: Record<string, string> = {
    users: "user",
    staff: "staff",
    clients: "client",
    cases: "case",
    contacts: "contact",
    todos: "todo",
    family_relations: "familyRelation",
    deletion_requests: "deletionRequest",
    audit_logs: "auditLog",
    client_photos: "clientPhoto",
  };

  /** Implicit tables queried via $queryRaw, in call order */
  const IMPLICIT_TABLES = ["_CaseToStaff", "_ContactToStaff", "_StaffToTodo"];

  const mockMkdir = vi.fn().mockResolvedValue(undefined);
  const mockWriteFile = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  /**
   * Build a prisma mock where tables in `failingSet` reject with an error,
   * and all other tables resolve with a small array of fake records.
   */
  function buildPrismaMockWithFailures(failingSet: Set<string>) {
    // Build model table mocks
    const mock: Record<string, unknown> = {};
    for (const [tableName, modelName] of Object.entries(MODEL_TABLES)) {
      if (failingSet.has(tableName)) {
        mock[modelName] = {
          findMany: vi.fn().mockRejectedValue(new Error(`Export failed: ${tableName}`)),
        };
      } else {
        mock[modelName] = {
          findMany: vi.fn().mockResolvedValue([{ id: 1 }]),
        };
      }
    }

    // Build $queryRaw mock — called sequentially for the 3 implicit tables
    const rawQueryFn = vi.fn();
    for (const implicitTable of IMPLICIT_TABLES) {
      if (failingSet.has(implicitTable)) {
        rawQueryFn.mockRejectedValueOnce(new Error(`Export failed: ${implicitTable}`));
      } else {
        rawQueryFn.mockResolvedValueOnce([{ A: 1, B: 2 }]);
      }
    }
    mock.$queryRaw = rawQueryFn;

    return mock;
  }

  it("status is 'complete' when no failures, 'partial' with correct errors when failures exist", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.subarray([...ALL_TABLE_NAMES], { minLength: 0, maxLength: 13 }),
        async (failingTables) => {
          vi.resetModules();
          mockMkdir.mockClear();
          mockWriteFile.mockClear();

          const failingSet = new Set(failingTables);

          vi.doMock("fs/promises", () => ({
            mkdir: mockMkdir,
            writeFile: mockWriteFile,
          }));

          vi.doMock("@/app/_lib/db", () => ({
            prisma: buildPrismaMockWithFailures(failingSet),
          }));

          const { runBackup } = await import("@/app/_lib/utils/backup");
          const result = await runBackup();

          // Also parse the metadata.json that was written to disk
          const metadataCall = mockWriteFile.mock.calls.find((call) =>
            (call[0] as string).endsWith("metadata.json")
          );
          expect(metadataCall).toBeDefined();
          const writtenMetadata = JSON.parse(metadataCall![1] as string);

          if (failingSet.size === 0) {
            // No failures → status must be "complete"
            expect(result.metadata.status).toBe("complete");
            expect(writtenMetadata.status).toBe("complete");
            // errors should not exist or be empty
            expect(result.metadata.errors ?? []).toHaveLength(0);
            expect(writtenMetadata.errors).toBeUndefined();
          } else {
            // At least one failure → status must be "partial"
            expect(result.metadata.status).toBe("partial");
            expect(writtenMetadata.status).toBe("partial");

            // errors array must contain exactly the failed table names
            const errorTableNames = (result.metadata.errors ?? []).map(
              (e: { table: string }) => e.table
            );
            const writtenErrorTableNames = (writtenMetadata.errors ?? []).map(
              (e: { table: string }) => e.table
            );

            // Same set of failed tables (order may differ due to sequential processing,
            // but since tables are processed in fixed order, the order is deterministic)
            expect(new Set(errorTableNames)).toEqual(failingSet);
            expect(new Set(writtenErrorTableNames)).toEqual(failingSet);

            // Exact count match
            expect(errorTableNames).toHaveLength(failingSet.size);
            expect(writtenErrorTableNames).toHaveLength(failingSet.size);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});


/**
 * **Validates: Requirements 5.2, 5.3**
 *
 * Property 6: Cleanup respects retention policy and minimum count
 *
 * For any set of Backup_Snapshots with arbitrary timestamps and any retention
 * period in days, cleanupOldBackups SHALL delete only snapshots older than the
 * retention period, AND SHALL always preserve at least the 3 most recent
 * snapshots regardless of their age. The number of remaining snapshots after
 * cleanup SHALL be max(3, count of snapshots within retention period).
 */
describe("Feature: backup-restore, Property 6: Cleanup respects retention policy and minimum count", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  /**
   * Arbitrary: generate 1–20 backup timestamps as epoch-ms offsets from "now",
   * plus a retention period of 1–365 days.
   */
  const backupSetArb = fc.record({
    /** Each entry is a number of milliseconds *before* now (0 = now, positive = past) */
    agesMs: fc.array(
      fc.integer({ min: 0, max: 400 * 24 * 60 * 60 * 1000 }), // up to ~400 days ago
      { minLength: 1, maxLength: 20 }
    ),
    retentionDays: fc.integer({ min: 1, max: 365 }),
  });

  it("deleted backups are all older than retention period, at least 3 kept, remaining = max(3, within-retention count)", async () => {
    await fc.assert(
      fc.asyncProperty(backupSetArb, async ({ agesMs, retentionDays }) => {
        vi.resetModules();

        // Fix "now" for deterministic cutoff calculation
        const now = new Date("2025-06-01T00:00:00.000Z");
        const cutoffMs = retentionDays * 24 * 60 * 60 * 1000;
        const cutoffDate = new Date(now.getTime() - cutoffMs);

        // Build backup entries sorted by timestamp descending (newest first) — same as the function does
        const backups = agesMs.map((age, i) => {
          const ts = new Date(now.getTime() - age);
          return {
            name: `backup-${i}`,
            timestamp: ts,
          };
        });
        // Sort newest first (same order cleanupOldBackups uses internally)
        backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        // Build mock directory entries (Dirent-like objects)
        const mockDirents = backups.map((b) => ({
          name: b.name,
          isDirectory: () => true,
          isFile: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
          parentPath: "",
          path: "",
        }));

        // Track which directories get deleted
        const deletedDirs: string[] = [];
        const mockRm = vi.fn().mockImplementation(async (dirPath: string) => {
          // Extract just the directory name from the path
          const parts = dirPath.split(/[\\/]/);
          deletedDirs.push(parts[parts.length - 1]);
        });

        // Mock readFile to return metadata.json with the correct timestamp for each backup
        const metadataMap = new Map<string, string>();
        for (const b of backups) {
          metadataMap.set(
            b.name,
            JSON.stringify({ timestamp: b.timestamp.toISOString(), version: 2, status: "complete", tables: [] })
          );
        }

        const mockReadFile = vi.fn().mockImplementation(async (filePath: string) => {
          // Extract the backup directory name from the path (e.g., "./backups/backup-0/metadata.json")
          const parts = filePath.split(/[\\/]/);
          const dirName = parts[parts.length - 2]; // second-to-last segment
          const content = metadataMap.get(dirName);
          if (content) return content;
          throw new Error("File not found");
        });

        const mockReaddir = vi.fn().mockResolvedValue(mockDirents);

        vi.doMock("fs/promises", () => ({
          readdir: mockReaddir,
          readFile: mockReadFile,
          rm: mockRm,
          mkdir: vi.fn().mockResolvedValue(undefined),
          writeFile: vi.fn().mockResolvedValue(undefined),
          stat: vi.fn().mockResolvedValue({ size: 100 }),
        }));

        // Mock prisma (not used by cleanupOldBackups but imported at module level)
        vi.doMock("@/app/_lib/db", () => ({
          prisma: {},
        }));

        // Set retention days env var
        process.env.BACKUP_RETENTION_DAYS = String(retentionDays);

        // Stub Date to control "now" inside cleanupOldBackups
        const originalDate = globalThis.Date;
        const MockDate = class extends originalDate {
          constructor(...args: unknown[]) {
            if (args.length === 0) {
              super(now.getTime());
            } else {
              // @ts-expect-error — spread into Date constructor
              super(...args);
            }
          }
        } as DateConstructor;
        MockDate.now = () => now.getTime();
        MockDate.parse = originalDate.parse;
        MockDate.UTC = originalDate.UTC;
        globalThis.Date = MockDate;

        try {
          const { cleanupOldBackups } = await import("@/app/_lib/utils/backup");
          const deleted = await cleanupOldBackups();

          // --- Assertions ---

          const totalCount = backups.length;
          const MIN_KEEP = 3;

          // 1) Deleted backups must all be older than the retention cutoff
          for (const delName of deleted) {
            const backup = backups.find((b) => b.name === delName);
            expect(backup).toBeDefined();
            expect(backup!.timestamp.getTime()).toBeLessThan(cutoffDate.getTime());
          }

          // 2) At least min(3, totalCount) backups are kept
          const remainingCount = totalCount - deleted.length;
          expect(remainingCount).toBeGreaterThanOrEqual(Math.min(MIN_KEEP, totalCount));

          // 3) Remaining count = max(3, count of backups within retention period)
          //    "within retention" means timestamp >= cutoffDate
          const withinRetentionCount = backups.filter(
            (b) => b.timestamp.getTime() >= cutoffDate.getTime()
          ).length;
          const expectedRemaining = Math.min(
            totalCount,
            Math.max(MIN_KEEP, withinRetentionCount)
          );
          expect(remainingCount).toBe(expectedRemaining);

          // 4) The 3 most recent backups (indices 0,1,2) are never deleted
          const top3Names = backups.slice(0, Math.min(MIN_KEEP, totalCount)).map((b) => b.name);
          for (const name of top3Names) {
            expect(deleted).not.toContain(name);
          }
        } finally {
          globalThis.Date = originalDate;
          delete process.env.BACKUP_RETENTION_DAYS;
        }
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Validates: Requirements 6.3**
 *
 * Property 7: Backup list is sorted by timestamp descending
 *
 * For any set of Backup_Snapshots with arbitrary timestamps,
 * listBackups() SHALL return them sorted such that for every consecutive
 * pair (backups[i], backups[i+1]), backups[i].timestamp >= backups[i+1].timestamp.
 */
describe("Feature: backup-restore, Property 7: Backup list is sorted by timestamp descending", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  /**
   * Arbitrary: generate 1–15 backup entries, each with a random ISO 8601 timestamp.
   * We use dates spread across a wide range to ensure varied ordering.
   */
  const backupEntriesArb = fc.array(
    fc.integer({ min: new Date("2020-01-01").getTime(), max: new Date("2030-12-31").getTime() }).map((ms) => new Date(ms)),
    { minLength: 0, maxLength: 15 }
  );

  it("listBackups() returns results where each consecutive pair satisfies timestamp[i] >= timestamp[i+1]", async () => {
    await fc.assert(
      fc.asyncProperty(backupEntriesArb, async (timestamps) => {
        vi.resetModules();

        // Build backup directory entries and their metadata
        const backupDirs = timestamps.map((ts, i) => ({
          dirName: `backup-${i}`,
          timestamp: ts.toISOString(),
        }));

        // Mock Dirent-like objects for the top-level readdir call (withFileTypes: true)
        const mockDirents = backupDirs.map((b) => ({
          name: b.dirName,
          isDirectory: () => true,
          isFile: () => false,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isFIFO: () => false,
          isSocket: () => false,
          isSymbolicLink: () => false,
          parentPath: "",
          path: "",
        }));

        // Build metadata map for readFile mock
        const metadataMap = new Map<string, string>();
        for (const b of backupDirs) {
          metadataMap.set(
            b.dirName,
            JSON.stringify({
              timestamp: b.timestamp,
              version: 2,
              status: "complete",
              tables: [],
            })
          );
        }

        const mockReadFile = vi.fn().mockImplementation(async (filePath: string) => {
          const parts = filePath.split(/[\\/]/);
          const dirName = parts[parts.length - 2];
          const content = metadataMap.get(dirName);
          if (content) return content;
          throw new Error("File not found");
        });

        // readdir is called in two contexts:
        // 1. Top-level: readdir(BACKUP_DIR, { withFileTypes: true }) → returns Dirent[]
        // 2. Inside getDirectorySize: readdir(subDir, { withFileTypes: true }) → returns empty Dirent[]
        const mockReaddir = vi.fn().mockImplementation(async (dirPath: string, _opts?: unknown) => {
          // If this is the BACKUP_DIR call, return the mock dirents
          if (!dirPath.includes("backup-") || dirPath.endsWith("backups")) {
            return mockDirents;
          }
          // For getDirectorySize recursive calls on subdirectories, return a single mock file entry
          return [
            {
              name: "metadata.json",
              isDirectory: () => false,
              isFile: () => true,
              isBlockDevice: () => false,
              isCharacterDevice: () => false,
              isFIFO: () => false,
              isSocket: () => false,
              isSymbolicLink: () => false,
              parentPath: "",
              path: "",
            },
          ];
        });

        const mockStat = vi.fn().mockResolvedValue({ size: 100 });

        vi.doMock("fs/promises", () => ({
          readdir: mockReaddir,
          readFile: mockReadFile,
          stat: mockStat,
          mkdir: vi.fn().mockResolvedValue(undefined),
          writeFile: vi.fn().mockResolvedValue(undefined),
          rm: vi.fn().mockResolvedValue(undefined),
        }));

        vi.doMock("@/app/_lib/db", () => ({
          prisma: {},
        }));

        const { listBackups } = await import("@/app/_lib/utils/backup");
        const result = await listBackups();

        // Verify length matches input
        expect(result).toHaveLength(timestamps.length);

        // Verify descending sort: for every consecutive pair, timestamp[i] >= timestamp[i+1]
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].timestamp >= result[i + 1].timestamp).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});



/**
 * **Validates: Requirements 3.4, 3.5, 3.6, 3.7**
 *
 * Property 4: Record comparison correctly classifies all records
 *
 * For any backup dataset and any current database dataset for a given table,
 * the restore preview comparison SHALL classify every record into exactly one
 * of four categories such that: (a) records with matching ID and identical
 * content are Identical_Record, (b) records only in backup are New_Record,
 * (c) records with matching ID but different content are Conflict_Record with
 * correct diffFields, and (d) records only in the database are Deleted_Record.
 * The sum of all four categories SHALL equal the union of unique IDs across
 * both datasets.
 */
describe("Feature: backup-restore, Property 4: Record comparison correctly classifies all records", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  /** Arbitrary for a single staff-like record with a given ID */
  const staffRecordArb = (id: number) =>
    fc.record({
      id: fc.constant(id),
      name: fc.string({ minLength: 1, maxLength: 20 }),
      updatedAt: fc.integer({ min: 1577836800000, max: 1893456000000 }).map(
        (ms) => new Date(ms).toISOString()
      ),
    });

  /** Generate a dataset of unique-ID records (0–30 records, IDs in 1–100) */
  const datasetArb = fc
    .uniqueArray(fc.integer({ min: 1, max: 100 }), { minLength: 0, maxLength: 30 })
    .chain((ids) =>
      ids.length === 0
        ? fc.constant([] as { id: number; name: string; updatedAt: string }[])
        : fc.tuple(...ids.map((id) => staffRecordArb(id))).map((arr) => [...arr])
    );

  /**
   * Build mocks for generateRestorePreview:
   * - fs/promises readFile: returns metadata.json and staff.json from backup, empty arrays for other tables
   * - prisma: staff.findMany returns currentRecords, all other tables return empty arrays
   */
  function setupMocks(
    backupRecords: Record<string, unknown>[],
    currentRecords: Record<string, unknown>[]
  ) {
    const ALL_TABLES = [
      "users", "staff", "clients", "cases", "contacts", "todos",
      "family_relations", "deletion_requests", "audit_logs", "client_photos",
      "_CaseToStaff", "_ContactToStaff", "_StaffToTodo",
    ];

    // Build file content map: metadata.json + each table's JSON
    const fileContents: Record<string, string> = {};
    fileContents["metadata.json"] = JSON.stringify({
      timestamp: new Date().toISOString(),
      version: 2,
      status: "complete",
      tables: ALL_TABLES.map((t) => ({
        name: t,
        expectedCount: t === "staff" ? backupRecords.length : 0,
        actualCount: t === "staff" ? backupRecords.length : 0,
      })),
    });
    for (const t of ALL_TABLES) {
      fileContents[`${t}.json`] = JSON.stringify(t === "staff" ? backupRecords : []);
    }

    const mockReadFile = vi.fn().mockImplementation(async (filePath: string) => {
      const fileName = filePath.split(/[\\/]/).pop()!;
      if (fileContents[fileName] !== undefined) {
        return fileContents[fileName];
      }
      throw new Error(`File not found: ${filePath}`);
    });

    vi.doMock("fs/promises", () => ({
      readFile: mockReadFile,
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
      readdir: vi.fn().mockResolvedValue([]),
      stat: vi.fn().mockResolvedValue({ size: 0 }),
      rm: vi.fn().mockResolvedValue(undefined),
    }));

    // Build prisma mock: staff returns currentRecords, everything else empty
    const emptyFindMany = vi.fn().mockResolvedValue([]);
    const rawQueryFn = vi.fn()
      .mockResolvedValueOnce([])  // _CaseToStaff
      .mockResolvedValueOnce([])  // _ContactToStaff
      .mockResolvedValueOnce([]); // _StaffToTodo

    vi.doMock("@/app/_lib/db", () => ({
      prisma: {
        user: { findMany: emptyFindMany },
        staff: { findMany: vi.fn().mockResolvedValue(currentRecords) },
        client: { findMany: emptyFindMany },
        case: { findMany: emptyFindMany },
        contact: { findMany: emptyFindMany },
        todo: { findMany: emptyFindMany },
        familyRelation: { findMany: emptyFindMany },
        deletionRequest: { findMany: emptyFindMany },
        auditLog: { findMany: emptyFindMany },
        clientPhoto: { findMany: emptyFindMany },
        $queryRaw: rawQueryFn,
      },
    }));
  }

  it("each record belongs to exactly one category, sum equals union of IDs, identical have same content, conflicts have correct diffFields", async () => {
    await fc.assert(
      fc.asyncProperty(datasetArb, datasetArb, async (backupArr, currentArr) => {
        vi.resetModules();

        const backupRecords = backupArr as Record<string, unknown>[];
        const currentRecords = currentArr as Record<string, unknown>[];

        setupMocks(backupRecords, currentRecords);

        const { generateRestorePreview } = await import("@/app/_lib/utils/restore");
        const preview = await generateRestorePreview("test-snapshot");

        // Find the staff table result
        const staffResult = preview.tables.find((t) => t.tableName === "staff");
        expect(staffResult).toBeDefined();
        const result = staffResult!;

        // Build ID sets for verification
        const backupIds = new Set(backupRecords.map((r) => r.id as number));
        const currentIds = new Set(currentRecords.map((r) => r.id as number));
        const unionIds = new Set([...backupIds, ...currentIds]);

        // Collect classified IDs
        const newIds = new Set(result.newRecords.map((r) => r.id as number));
        const conflictIds = new Set(result.conflicts.map((r) => r.id as number));
        const deletedIds = new Set(result.deleted.map((r) => r.id as number));

        // For identical records, we need to compute them from the known sets
        // identical = IDs in both backup and current with same content
        const backupMap = new Map(backupRecords.map((r) => [r.id as number, r]));
        const currentMap = new Map(currentRecords.map((r) => [r.id as number, r]));

        // 1) Sum of four categories equals union of unique IDs
        const totalClassified = result.identical + newIds.size + conflictIds.size + deletedIds.size;
        expect(totalClassified).toBe(unionIds.size);

        // 2) New records: only in backup, not in current DB
        for (const id of newIds) {
          expect(backupIds.has(id)).toBe(true);
          expect(currentIds.has(id)).toBe(false);
        }

        // 3) Deleted records: only in current DB, not in backup
        for (const id of deletedIds) {
          expect(currentIds.has(id)).toBe(true);
          expect(backupIds.has(id)).toBe(false);
        }

        // 4) Conflict records: in both, but different content
        for (const conflict of result.conflicts) {
          const id = conflict.id as number;
          expect(backupIds.has(id)).toBe(true);
          expect(currentIds.has(id)).toBe(true);

          // diffFields should be non-empty
          expect(conflict.diffFields.length).toBeGreaterThan(0);

          // Verify diffFields are correct: each listed field actually differs
          const bRec = backupMap.get(id)!;
          const cRec = currentMap.get(id)!;
          for (const field of conflict.diffFields) {
            const bVal = JSON.stringify(bRec[field]);
            const cVal = JSON.stringify(cRec[field]);
            expect(bVal).not.toBe(cVal);
          }
        }

        // 5) Identical records: in both with same content — verify count
        let expectedIdentical = 0;
        for (const id of backupIds) {
          if (currentIds.has(id)) {
            const bRec = backupMap.get(id)!;
            const cRec = currentMap.get(id)!;
            const allKeys = new Set([...Object.keys(bRec), ...Object.keys(cRec)]);
            let same = true;
            for (const key of allKeys) {
              if (JSON.stringify(bRec[key]) !== JSON.stringify(cRec[key])) {
                same = false;
                break;
              }
            }
            if (same) expectedIdentical++;
          }
        }
        expect(result.identical).toBe(expectedIdentical);

        // 6) No ID appears in more than one category
        for (const id of newIds) {
          expect(conflictIds.has(id)).toBe(false);
          expect(deletedIds.has(id)).toBe(false);
        }
        for (const id of conflictIds) {
          expect(newIds.has(id)).toBe(false);
          expect(deletedIds.has(id)).toBe(false);
        }
        for (const id of deletedIds) {
          expect(newIds.has(id)).toBe(false);
          expect(conflictIds.has(id)).toBe(false);
        }

        // 7) All non-empty tables should have 0 for other tables (since we only populated staff)
        for (const table of preview.tables) {
          if (table.tableName !== "staff") {
            expect(table.identical).toBe(0);
            expect(table.newRecords).toHaveLength(0);
            expect(table.conflicts).toHaveLength(0);
            expect(table.deleted).toHaveLength(0);
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * **Validates: Requirements 4.4**
 *
 * Property 5: Incomplete conflict resolution is rejected
 *
 * For any restore preview containing N conflict records (N > 0) and any
 * conflictResolutions array with fewer than N entries or with entries
 * referencing non-existent conflicts, applyRestore SHALL reject the request.
 * Only when conflictResolutions contains exactly one valid resolution per
 * conflict record SHALL the apply proceed.
 */
describe("Feature: backup-restore, Property 5: Incomplete conflict resolution is rejected", () => {
  const ALL_TABLES = [
    "users", "staff", "clients", "cases", "contacts", "todos",
    "family_relations", "deletion_requests", "audit_logs", "client_photos",
    "_CaseToStaff", "_ContactToStaff", "_StaffToTodo",
  ];

  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  /**
   * Build backup records and current DB records for the "staff" table
   * that share the same IDs but have DIFFERENT name fields → guaranteed conflicts.
   */
  function makeConflictPair(ids: number[]) {
    const backupRecords = ids.map((id) => ({
      id,
      name: `backup-name-${id}`,
      isActive: true,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    }));
    const currentRecords = ids.map((id) => ({
      id,
      name: `current-name-${id}`,
      isActive: true,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-02T00:00:00.000Z",
    }));
    return { backupRecords, currentRecords };
  }

  /**
   * Set up mocks so that generateRestorePreview (called internally by applyRestore)
   * returns a preview with known conflicts on the "staff" table.
   */
  function setupMocksForConflicts(
    backupRecords: Record<string, unknown>[],
    currentRecords: Record<string, unknown>[],
    transactionMock?: ReturnType<typeof vi.fn>
  ) {
    // File contents: metadata.json + per-table JSON
    const fileContents: Record<string, string> = {};
    fileContents["metadata.json"] = JSON.stringify({
      timestamp: new Date().toISOString(),
      version: 2,
      status: "complete",
      tables: ALL_TABLES.map((t) => ({
        name: t,
        expectedCount: t === "staff" ? backupRecords.length : 0,
        actualCount: t === "staff" ? backupRecords.length : 0,
      })),
    });
    for (const t of ALL_TABLES) {
      fileContents[`${t}.json`] = JSON.stringify(t === "staff" ? backupRecords : []);
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
      readdir: vi.fn().mockResolvedValue([]),
      stat: vi.fn().mockResolvedValue({ size: 0 }),
      rm: vi.fn().mockResolvedValue(undefined),
    }));

    // Prisma mock: staff returns currentRecords, everything else empty
    const emptyFindMany = vi.fn().mockResolvedValue([]);
    const rawQueryFn = vi.fn()
      .mockResolvedValueOnce([])   // _CaseToStaff
      .mockResolvedValueOnce([])   // _ContactToStaff
      .mockResolvedValueOnce([]);  // _StaffToTodo

    // Transaction mock: execute the callback so the "accepted" path works
    const txProxy = new Proxy({}, {
      get: (_target, prop) => {
        if (prop === "$executeRawUnsafe") return vi.fn().mockResolvedValue(1);
        return undefined;
      },
    });
    const $transaction = transactionMock ?? vi.fn().mockImplementation(async (cb: Function) => cb(txProxy));

    vi.doMock("@/app/_lib/db", () => ({
      prisma: {
        user: { findMany: emptyFindMany },
        staff: { findMany: vi.fn().mockResolvedValue(currentRecords) },
        client: { findMany: emptyFindMany },
        case: { findMany: emptyFindMany },
        contact: { findMany: emptyFindMany },
        todo: { findMany: emptyFindMany },
        familyRelation: { findMany: emptyFindMany },
        deletionRequest: { findMany: emptyFindMany },
        auditLog: { findMany: emptyFindMany },
        clientPhoto: { findMany: emptyFindMany },
        $queryRaw: rawQueryFn,
        $transaction,
      },
    }));
  }

  /** Arbitrary: 1–20 unique conflict IDs */
  const conflictIdsArb = fc.uniqueArray(fc.integer({ min: 1, max: 200 }), {
    minLength: 1,
    maxLength: 20,
  });

  it("resolution count less than conflict count → rejected", async () => {
    await fc.assert(
      fc.asyncProperty(
        conflictIdsArb,
        async (conflictIds) => {
          vi.resetModules();

          const { backupRecords, currentRecords } = makeConflictPair(conflictIds);
          setupMocksForConflicts(backupRecords, currentRecords);

          const { applyRestore } = await import("@/app/_lib/utils/restore");

          // Provide fewer resolutions than conflicts (take a strict subset)
          const subsetCount = Math.max(0, conflictIds.length - 1);
          const incompleteResolutions = conflictIds.slice(0, subsetCount).map((id) => ({
            tableName: "staff",
            recordId: id,
            choice: "backup" as const,
          }));

          await expect(
            applyRestore("test-snapshot", incompleteResolutions)
          ).rejects.toThrow("尚有未解決的衝突記錄");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("resolution contains non-existent ID → rejected", async () => {
    await fc.assert(
      fc.asyncProperty(
        conflictIdsArb,
        fc.integer({ min: 1000, max: 9999 }),
        async (conflictIds, bogusId) => {
          vi.resetModules();

          const { backupRecords, currentRecords } = makeConflictPair(conflictIds);
          setupMocksForConflicts(backupRecords, currentRecords);

          const { applyRestore } = await import("@/app/_lib/utils/restore");

          // Provide all correct resolutions PLUS one with a non-existent ID
          const resolutions = conflictIds.map((id) => ({
            tableName: "staff",
            recordId: id,
            choice: "backup" as const,
          }));
          resolutions.push({
            tableName: "staff",
            recordId: bogusId,
            choice: "backup" as const,
          });

          await expect(
            applyRestore("test-snapshot", resolutions)
          ).rejects.toThrow("尚有未解決的衝突記錄");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("complete and correct resolution → accepted", async () => {
    await fc.assert(
      fc.asyncProperty(
        conflictIdsArb,
        async (conflictIds) => {
          vi.resetModules();

          const { backupRecords, currentRecords } = makeConflictPair(conflictIds);
          setupMocksForConflicts(backupRecords, currentRecords);

          const { applyRestore } = await import("@/app/_lib/utils/restore");

          // Provide exactly one valid resolution per conflict
          const completeResolutions = conflictIds.map((id) => ({
            tableName: "staff",
            recordId: id,
            choice: "backup" as const,
          }));

          const result = await applyRestore("test-snapshot", completeResolutions);
          expect(result.success).toBe(true);

          // Staff table should report the correct conflict resolved count
          const staffResult = result.tables.find((t) => t.tableName === "staff");
          expect(staffResult).toBeDefined();
          expect(staffResult!.conflictResolvedCount).toBe(conflictIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
