import { prisma } from "../db";
import { writeFile, mkdir, readdir, stat, readFile, rm } from "fs/promises";
import { join } from "path";
import { format } from "date-fns";
import { Dirent } from "fs";

// --- Types ---

export interface BackupMetadata {
  timestamp: string; // ISO 8601
  version: number; // Backup version, 2 for new format
  status: "complete" | "partial";
  tables: TableBackupInfo[];
  errors?: TableError[];
}

export interface TableBackupInfo {
  name: string;
  expectedCount: number;
  actualCount: number;
}

export interface TableError {
  table: string;
  error: string;
}

export interface BackupResult {
  snapshotName: string;
  metadata: BackupMetadata;
}

export interface BackupListItem {
  snapshotName: string;
  timestamp: string;
  status: "complete" | "partial" | "unknown";
  tables: TableBackupInfo[];
  sizeBytes: number;
}

// --- Constants ---

export const BACKUP_DIR = process.env.BACKUP_DIR || "./backups";

// --- Backup table definitions ---

interface TableDef {
  name: string;
  query: () => Promise<unknown[]>;
}

function getTableDefs(): TableDef[] {
  return [
    {
      name: "users",
      query: () =>
        prisma.user.findMany({
          select: {
            id: true,
            email: true,
            role: true,
            staffId: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
    },
    { name: "staff", query: () => prisma.staff.findMany() },
    { name: "clients", query: () => prisma.client.findMany() },
    { name: "cases", query: () => prisma.case.findMany() },
    { name: "contacts", query: () => prisma.contact.findMany() },
    { name: "todos", query: () => prisma.todo.findMany() },
    {
      name: "family_relations",
      query: () => prisma.familyRelation.findMany(),
    },
    {
      name: "deletion_requests",
      query: () => prisma.deletionRequest.findMany(),
    },
    { name: "audit_logs", query: () => prisma.auditLog.findMany() },
    { name: "client_photos", query: () => prisma.clientPhoto.findMany() },
    {
      name: "_CaseToStaff",
      query: () =>
        prisma.$queryRaw`SELECT * FROM "_CaseToStaff"` as Promise<unknown[]>,
    },
    {
      name: "_ContactToStaff",
      query: () =>
        prisma.$queryRaw`SELECT * FROM "_ContactToStaff"` as Promise<
          unknown[]
        >,
    },
    {
      name: "_StaffToTodo",
      query: () =>
        prisma.$queryRaw`SELECT * FROM "_StaffToTodo"` as Promise<unknown[]>,
    },
  ];
}

// --- Functions ---

/** Execute a full backup of all tables, returning the result with metadata */
export async function runBackup(): Promise<BackupResult> {
  const now = new Date();
  const snapshotName = format(now, "yyyy-MM-dd_HH-mm-ss");
  const dir = join(BACKUP_DIR, snapshotName);
  await mkdir(dir, { recursive: true });

  const tables = getTableDefs();
  const tableInfos: TableBackupInfo[] = [];
  const errors: TableError[] = [];

  for (const table of tables) {
    try {
      const data = await table.query();
      const expectedCount = data.length;

      await writeFile(
        join(dir, `${table.name}.json`),
        JSON.stringify(data, null, 2)
      );

      tableInfos.push({
        name: table.name,
        expectedCount,
        actualCount: expectedCount,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.error(`Backup failed for ${table.name}:`, error);
      errors.push({ table: table.name, error: message });
      tableInfos.push({
        name: table.name,
        expectedCount: 0,
        actualCount: 0,
      });
    }
  }

  const metadata: BackupMetadata = {
    timestamp: now.toISOString(),
    version: 2,
    status: errors.length > 0 ? "partial" : "complete",
    tables: tableInfos,
    ...(errors.length > 0 ? { errors } : {}),
  };

  await writeFile(
    join(dir, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  return { snapshotName, metadata };
}

/** Recursively calculate total size of all files in a directory */
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      totalSize += await getDirectorySize(entryPath);
    } else {
      const fileStat = await stat(entryPath);
      totalSize += fileStat.size;
    }
  }
  return totalSize;
}

/** List all backup snapshots, sorted newest first */
export async function listBackups(): Promise<BackupListItem[]> {
  let entries: Dirent<string>[];
  try {
    entries = await readdir(BACKUP_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const dirs = entries.filter((e) => e.isDirectory());

  const items: BackupListItem[] = [];
  for (const dir of dirs) {
    const dirPath = join(BACKUP_DIR, dir.name);
    let timestamp = "";
    let status: "complete" | "partial" | "unknown" = "unknown";
    let tables: TableBackupInfo[] = [];

    try {
      const raw = await readFile(join(dirPath, "metadata.json"), "utf-8");
      const metadata: BackupMetadata = JSON.parse(raw);
      timestamp = metadata.timestamp;
      status = metadata.status;
      tables = metadata.tables;
    } catch {
      // metadata.json not found or invalid — use directory name as fallback timestamp
      timestamp = dir.name;
    }

    const sizeBytes = await getDirectorySize(dirPath);

    items.push({
      snapshotName: dir.name,
      timestamp,
      status,
      tables,
      sizeBytes,
    });
  }

  // Sort by timestamp descending (newest first)
  items.sort((a, b) => (a.timestamp >= b.timestamp ? -1 : 1));

  return items;
}

/** Clean up old backups based on retention policy, always keeping at least 3 most recent */
export async function cleanupOldBackups(): Promise<string[]> {
  const retentionDays = parseInt(
    process.env.BACKUP_RETENTION_DAYS || "180",
    10
  );
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  // List all backup directories with their timestamps
  let dirNames: string[];
  try {
    const entries = await readdir(BACKUP_DIR, { withFileTypes: true });
    dirNames = entries.filter((e) => e.isDirectory()).map((e) => String(e.name));
  } catch {
    return [];
  }

  // Build list with timestamps for sorting
  const backups: { name: string; timestamp: Date }[] = [];
  for (const name of dirNames) {
    const dirPath = join(BACKUP_DIR, name);
    let timestamp: Date;

    try {
      const raw = await readFile(join(dirPath, "metadata.json"), "utf-8");
      const metadata: BackupMetadata = JSON.parse(raw);
      timestamp = new Date(metadata.timestamp);
    } catch {
      // No metadata — parse directory name as timestamp fallback
      // Directory names follow format: yyyy-MM-dd_HH-mm-ss
      const parsed = new Date(
        name.replace(/_/g, " ").replace(/-/g, (m: string, offset: number) => (offset > 10 ? ":" : "-"))
      );
      timestamp = isNaN(parsed.getTime()) ? new Date(0) : parsed;
    }

    backups.push({ name, timestamp });
  }

  // Sort by timestamp descending (newest first)
  backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  // Always keep at least 3 most recent backups
  const MIN_KEEP = 3;
  const deleted: string[] = [];

  for (let i = 0; i < backups.length; i++) {
    // Always keep the first MIN_KEEP entries (most recent)
    if (i < MIN_KEEP) continue;

    const backup = backups[i];
    if (backup.timestamp < cutoffDate) {
      const dirPath = join(BACKUP_DIR, backup.name);
      await rm(dirPath, { recursive: true, force: true });
      console.log(`Deleted old backup: ${backup.name}`);
      deleted.push(backup.name);
    }
  }

  return deleted;
}
