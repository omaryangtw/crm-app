import { prisma } from "../db";
import { readFile } from "fs/promises";
import { join } from "path";
import { BACKUP_DIR, BackupMetadata } from "./backup";
import crypto from "crypto";

// --- Types ---

export interface RestorePreview {
  snapshotName: string;
  tables: TableRestorePreview[];
}

export interface TableRestorePreview {
  tableName: string;
  identical: number;
  newRecords: RecordDiff[];
  conflicts: ConflictRecord[];
  deleted: RecordDiff[];
}

export interface RecordDiff {
  id: number | string;
  data: Record<string, unknown>;
}

export interface ConflictRecord {
  id: number | string;
  tableName: string;
  backupData: Record<string, unknown>;
  currentData: Record<string, unknown>;
  backupUpdatedAt: string | null;
  currentUpdatedAt: string | null;
  diffFields: string[];
}

export interface ConflictResolution {
  tableName: string;
  recordId: number | string;
  choice: "backup" | "current";
}

export interface RestoreApplyResult {
  success: boolean;
  tables: TableApplyResult[];
}

export interface TableApplyResult {
  tableName: string;
  identicalCount: number;
  insertedCount: number;
  conflictResolvedCount: number;
  deletedCount: number;
}

// --- Restore lock ---

let restoreInProgress = false;

export function acquireRestoreLock(): boolean {
  if (restoreInProgress) return false;
  restoreInProgress = true;
  return true;
}

export function releaseRestoreLock(): void {
  restoreInProgress = false;
}

// --- Many-to-many table definitions ---

const MANY_TO_MANY_TABLES = ["_CaseToStaff", "_ContactToStaff", "_StaffToTodo"];

// Columns for many-to-many composite keys: [columnA, columnB]
const MANY_TO_MANY_COLUMNS: Record<string, [string, string]> = {
  _CaseToStaff: ["A", "B"],
  _ContactToStaff: ["A", "B"],
  _StaffToTodo: ["A", "B"],
};

// FK target tables for many-to-many columns A and B
const MANY_TO_MANY_FK_TARGETS: Record<string, { A: string; B: string }> = {
  _CaseToStaff: { A: "cases", B: "staff" },
  _ContactToStaff: { A: "contacts", B: "staff" },
  _StaffToTodo: { A: "staff", B: "todos" },
};

// Fields to exclude from comparison per table
const EXCLUDE_FIELDS: Record<string, string[]> = {
  users: ["password"],
};

// Prisma camelCase field → actual DB column name mapping per table
// Only tables with @map'd columns need entries; unmapped fields use the same name.
const FIELD_TO_COLUMN: Record<string, Record<string, string>> = {
  users: {
    staffId: "staff_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  staff: {
    isActive: "is_active",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  clients: {
    nameAlt: "name_alt",
    idn: "idn",
    isDead: "is_dead",
    householdAdmin: "household_admin",
    incomeStatus: "income_status",
    disabledStatus: "disabled_status",
    indigenousGroup: "indigenous_group",
    plainMountain: "plain_mountain",
    canCall: "can_call",
    phoneNote: "phone_note",
    phoneAlt: "phone_alt",
    phoneAltNote: "phone_alt_note",
    mobileNote: "mobile_note",
    mobileAlt: "mobile_alt",
    mobileAltNote: "mobile_alt_note",
    canMail: "can_mail",
    cityAlt: "city_alt",
    distAlt: "dist_alt",
    villAlt: "vill_alt",
    addrAlt: "addr_alt",
    addrNote: "addr_note",
    addrAltNote: "addr_alt_note",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  cases: {
    personInChargeLegacy: "person_in_charge_legacy",
    typesMajor: "types_major",
    typesMinor: "types_minor",
    clientId: "client_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  contacts: {
    contactType: "contact_type",
    isSuccess: "is_success",
    personInChargeLegacy: "person_in_charge_legacy",
    clientId: "client_id",
    caseId: "case_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  todos: {
    clientId: "client_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  family_relations: {
    personAId: "person_a_id",
    personBId: "person_b_id",
    relationAToB: "relation_a_to_b",
    relationBToA: "relation_b_to_a",
  },
  deletion_requests: {
    entityType: "entity_type",
    entityId: "entity_id",
    entitySnapshot: "entity_snapshot",
    cascadeSelection: "cascade_selection",
    requesterId: "requester_id",
    requesterEmail: "requester_email",
    reviewerId: "reviewer_id",
    reviewerEmail: "reviewer_email",
    reviewedAt: "reviewed_at",
    restoredAt: "restored_at",
    restoredById: "restored_by_id",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  audit_logs: {
    entityType: "entity_type",
    entityId: "entity_id",
    userId: "user_id",
    userEmail: "user_email",
    oldData: "old_data",
    newData: "new_data",
    changedFields: "changed_fields",
    createdAt: "created_at",
  },
  client_photos: {
    clientId: "client_id",
    photoPath: "photo_path",
    originalPhotoPath: "original_photo_path",
    createdAt: "created_at",
  },
};

/** Map a Prisma camelCase field name to the actual DB column name */
function toColumnName(tableName: string, fieldName: string): string {
  return FIELD_TO_COLUMN[tableName]?.[fieldName] ?? fieldName;
}

/** Restore processing order (FK-safe) */
const RESTORE_TABLE_ORDER = [
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
];

// --- Table query definitions (mirrors backup.ts) ---

interface RestoreTableDef {
  name: string;
  query: () => Promise<Record<string, unknown>[]>;
  primaryKey: "id" | "composite";
}

function getRestoreTableDefs(): RestoreTableDef[] {
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
        }) as Promise<Record<string, unknown>[]>,
      primaryKey: "id",
    },
    {
      name: "staff",
      query: () => prisma.staff.findMany() as Promise<Record<string, unknown>[]>,
      primaryKey: "id",
    },
    {
      name: "clients",
      query: () => prisma.client.findMany() as Promise<Record<string, unknown>[]>,
      primaryKey: "id",
    },
    {
      name: "cases",
      query: () => prisma.case.findMany() as Promise<Record<string, unknown>[]>,
      primaryKey: "id",
    },
    {
      name: "contacts",
      query: () => prisma.contact.findMany() as Promise<Record<string, unknown>[]>,
      primaryKey: "id",
    },
    {
      name: "todos",
      query: () => prisma.todo.findMany() as Promise<Record<string, unknown>[]>,
      primaryKey: "id",
    },
    {
      name: "family_relations",
      query: () => prisma.familyRelation.findMany() as Promise<Record<string, unknown>[]>,
      primaryKey: "id",
    },
    {
      name: "deletion_requests",
      query: () => prisma.deletionRequest.findMany() as Promise<Record<string, unknown>[]>,
      primaryKey: "id",
    },
    {
      name: "audit_logs",
      query: () => prisma.auditLog.findMany() as Promise<Record<string, unknown>[]>,
      primaryKey: "id",
    },
    {
      name: "client_photos",
      query: () => prisma.clientPhoto.findMany() as Promise<Record<string, unknown>[]>,
      primaryKey: "id",
    },
    {
      name: "_CaseToStaff",
      query: () =>
        prisma.$queryRaw`SELECT * FROM "_CaseToStaff"` as Promise<Record<string, unknown>[]>,
      primaryKey: "composite",
    },
    {
      name: "_ContactToStaff",
      query: () =>
        prisma.$queryRaw`SELECT * FROM "_ContactToStaff"` as Promise<Record<string, unknown>[]>,
      primaryKey: "composite",
    },
    {
      name: "_StaffToTodo",
      query: () =>
        prisma.$queryRaw`SELECT * FROM "_StaffToTodo"` as Promise<Record<string, unknown>[]>,
      primaryKey: "composite",
    },
  ];
}

// --- Helper functions ---

/**
 * Get the composite key for a many-to-many record.
 * Uses "A" + "B" column combination as the key string.
 */
function getCompositeKey(tableName: string, record: Record<string, unknown>): string {
  const [colA, colB] = MANY_TO_MANY_COLUMNS[tableName];
  return `${record[colA]}_${record[colB]}`;
}

/**
 * Normalize a value for comparison by converting Date objects to ISO strings
 * and BigInt to numbers.
 */
function normalizeValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return Number(value);
  return value;
}

/**
 * Compare two records field-by-field, returning the list of differing field names.
 * Excludes fields specified in EXCLUDE_FIELDS for the given table.
 */
function compareRecords(
  tableName: string,
  backupRecord: Record<string, unknown>,
  currentRecord: Record<string, unknown>
): string[] {
  const excludeFields = EXCLUDE_FIELDS[tableName] || [];
  const allKeys = Array.from(
    new Set([...Object.keys(backupRecord), ...Object.keys(currentRecord)])
  );

  const diffFields: string[] = [];
  for (const key of allKeys) {
    if (excludeFields.includes(key)) continue;

    const backupVal = normalizeValue(backupRecord[key]);
    const currentVal = normalizeValue(currentRecord[key]);

    if (JSON.stringify(backupVal) !== JSON.stringify(currentVal)) {
      diffFields.push(key);
    }
  }

  return diffFields;
}

/**
 * Extract updatedAt as ISO string from a record, or null if not present.
 */
function extractUpdatedAt(record: Record<string, unknown>): string | null {
  const val = record.updatedAt ?? record.updated_at;
  if (val == null) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val;
  return String(val);
}

// --- Main function ---

/**
 * Generate a restore preview by comparing backup data with the current database.
 * Validates metadata exists and status is "complete", then classifies each record
 * as identical, new, conflict, or deleted.
 */
export async function generateRestorePreview(
  snapshotName: string
): Promise<RestorePreview> {
  const snapshotDir = join(BACKUP_DIR, snapshotName);

  // 1. Read and validate metadata
  let metadataRaw: string;
  try {
    metadataRaw = await readFile(join(snapshotDir, "metadata.json"), "utf-8");
  } catch {
    throw new Error("備份不完整，無法還原");
  }

  const metadata: BackupMetadata = JSON.parse(metadataRaw);
  if (metadata.status !== "complete") {
    throw new Error("備份不完整，無法還原");
  }

  // 2. For each table, compare backup vs current DB
  const tableDefs = getRestoreTableDefs();
  const tableResults: TableRestorePreview[] = [];

  for (const tableDef of tableDefs) {
    const isManyToMany = MANY_TO_MANY_TABLES.includes(tableDef.name);

    // Read backup JSON
    let backupRecords: Record<string, unknown>[];
    try {
      const raw = await readFile(
        join(snapshotDir, `${tableDef.name}.json`),
        "utf-8"
      );
      backupRecords = JSON.parse(raw);
    } catch {
      // If backup file doesn't exist for this table, treat as empty
      backupRecords = [];
    }

    // Query current database
    const currentRecords = await tableDef.query();

    // Build maps by primary key
    const backupMap = new Map<string, Record<string, unknown>>();
    const currentMap = new Map<string, Record<string, unknown>>();

    for (const record of backupRecords) {
      const key = isManyToMany
        ? getCompositeKey(tableDef.name, record)
        : String(record.id);
      backupMap.set(key, record);
    }

    for (const record of currentRecords) {
      const key = isManyToMany
        ? getCompositeKey(tableDef.name, record)
        : String(record.id);
      currentMap.set(key, record);
    }

    // Classify records
    let identical = 0;
    const newRecords: RecordDiff[] = [];
    const conflicts: ConflictRecord[] = [];
    const deleted: RecordDiff[] = [];

    // Iterate backup map: find new, identical, conflict
    backupMap.forEach((backupRecord, key) => {
      const currentRecord = currentMap.get(key);

      if (!currentRecord) {
        // New record: only in backup
        newRecords.push({
          id: isManyToMany ? key : (backupRecord.id as number),
          data: backupRecord,
        });
      } else {
        // Compare records
        const diffFields = compareRecords(
          tableDef.name,
          backupRecord,
          currentRecord
        );

        if (diffFields.length === 0) {
          identical++;
        } else {
          conflicts.push({
            id: isManyToMany ? key : (backupRecord.id as number),
            tableName: tableDef.name,
            backupData: backupRecord,
            currentData: currentRecord,
            backupUpdatedAt: extractUpdatedAt(backupRecord),
            currentUpdatedAt: extractUpdatedAt(currentRecord),
            diffFields,
          });
        }
      }
    });

    // Iterate current map: find deleted
    currentMap.forEach((currentRecord, key) => {
      if (!backupMap.has(key)) {
        deleted.push({
          id: isManyToMany ? key : (currentRecord.id as number),
          data: currentRecord,
        });
      }
    });

    tableResults.push({
      tableName: tableDef.name,
      identical,
      newRecords,
      conflicts,
      deleted,
    });
  }

  return {
    snapshotName,
    tables: tableResults,
  };
}


// --- SQL helpers ---

/**
 * Format a JS value for use in a raw SQL string.
 * Handles null, string, boolean, number, Date, arrays, and JSON objects.
 */
export function formatSqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (Array.isArray(value)) {
    // PostgreSQL array literal: ARRAY['a','b']::text[]
    const elements = value.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(",");
    return `ARRAY[${elements}]::text[]`;
  }
  if (typeof value === "object") {
    // JSON value — use PostgreSQL dollar-quoting to safely handle
    // single quotes, backslashes, and Unicode in nested JSON
    const jsonStr = JSON.stringify(value);
    if (!jsonStr.includes("$$")) {
      return `$$${jsonStr}$$::jsonb`;
    }
    return `$json$${jsonStr}$json$::jsonb`;
  }
  // String — escape single quotes
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Parse a date-like value from backup JSON into a proper Date string for SQL.
 * Backup JSON stores dates as ISO strings; we need to handle them properly.
 */
function parseDateValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  if (typeof value === "string") {
    // Check if it looks like a date string
    const d = new Date(value);
    if (!isNaN(d.getTime())) return `'${d.toISOString()}'`;
    return `'${value.replace(/'/g, "''")}'`;
  }
  return formatSqlValue(value);
}

/** Date-type fields per table (these need date parsing from JSON strings) */
const DATE_FIELDS: Record<string, string[]> = {
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

/** FK fields per table → target table and nullability (for dangling FK validation in conflict resolution) */
const FK_FIELDS: Record<string, Record<string, { table: string; nullable: boolean }>> = {
  cases: {
    clientId: { table: "clients", nullable: false },
  },
  contacts: {
    clientId: { table: "clients", nullable: false },
    caseId: { table: "cases", nullable: true },
  },
  todos: {
    clientId: { table: "clients", nullable: true },
    caseId: { table: "cases", nullable: true },
  },
  family_relations: {
    clientId: { table: "clients", nullable: false },
    relatedClientId: { table: "clients", nullable: false },
  },
  deletion_requests: {
    requestedById: { table: "users", nullable: false },
    reviewedById: { table: "users", nullable: true },
    restoredById: { table: "users", nullable: true },
  },
  client_photos: {
    clientId: { table: "clients", nullable: false },
  },
};

/** Enum fields per table → PostgreSQL enum type name (for explicit casting in raw SQL) */
/** Enum fields per table → PostgreSQL enum type name (for explicit casting in raw SQL) */
const ENUM_FIELDS: Record<string, Record<string, string>> = {
  clients: {
    sex: "Sex",
    incomeStatus: "IncomeStatus",
    disabledStatus: "DisabledStatus",
    indigenousGroup: "IndigenousGroup",
    plainMountain: "PlainMountain",
  },
  cases: {
    status: "CaseStatus",
    typesMajor: "CaseTypeMajor",
    typesMinor: "CaseTypeMinor",
  },
  contacts: {
    contactType: "ContactType",
  },
  users: {
    role: "UserRole",
  },
  deletion_requests: {
    status: "DeletionRequestStatus",
  },
};

/**
 * Prisma name → PostgreSQL @map value for enums that use @map().
 * Prisma findMany() returns the Prisma-side name (e.g. "amis"),
 * but PostgreSQL expects the @map value (e.g. "阿美").
 * Enums without @map (Sex, DisabledStatus, UserRole, DeletionRequestStatus)
 * are omitted — their Prisma names ARE the PostgreSQL values.
 */
const ENUM_VALUE_MAP: Record<string, Record<string, string>> = {
  IncomeStatus: {
    low: "low",
    mid_low: "mid-low",
    mid_low_elderly: "mid-low-elderly",
  },
  IndigenousGroup: {
    amis: "阿美",
    atayal: "泰雅",
    bunun: "布農",
    kanakanavu: "卡那卡那富",
    kavalan: "噶瑪蘭",
    paiwan: "排灣",
    puyuma: "卑南",
    rukai: "魯凱",
    hla_alua: "拉阿魯哇",
    saisiyat: "賽夏",
    sakizaya: "撒奇萊雅",
    seediq: "賽德克",
    truku: "太魯閣",
    thao: "邵",
    tsou: "鄒",
    yami: "雅美",
  },
  PlainMountain: {
    plain: "平原",
    mountain: "山原",
  },
  CaseStatus: {
    in_progress: "處理中",
    closed: "結案",
  },
  CaseTypeMajor: {
    general: "一般",
    legal: "法律",
    emergency: "急難救助",
  },
  CaseTypeMinor: {
    general_minor: "一般",
    job_seeking: "求職",
    petition: "陳情",
    policy_suggestion: "施政建議",
    debt: "債務",
    labor_dispute: "勞資",
    traffic_accident: "車禍",
    family_affair: "家事",
    inheritance: "繼承",
    criminal: "刑事",
    consultation: "諮詢",
    non_litigation: "非訟",
    living_assistance: "生活扶助",
    death_relief: "死亡救助",
    emergency_relief: "急難紓困",
    major_disaster: "重大災害",
    medical_subsidy: "醫療補助",
  },
  ContactType: {
    outgoing: "撥出",
    incoming: "來電",
    visit: "親訪",
    sms: "簡訊",
  },
};

/**
 * Format a record field value for SQL, handling date fields specially.
 */
export function formatFieldValue(tableName: string, fieldName: string, value: unknown): string {
  // Enum fields need explicit PostgreSQL type casting
  const enumType = ENUM_FIELDS[tableName]?.[fieldName];
  if (enumType) {
    if (value === null || value === undefined) return "NULL";
    // Translate Prisma enum name → PostgreSQL @map value if mapping exists
    const strVal = String(value);
    const pgValue = ENUM_VALUE_MAP[enumType]?.[strVal] ?? strVal;
    return `'${pgValue.replace(/'/g, "''")}'::\"${enumType}\"`;
  }

  const dateFields = DATE_FIELDS[tableName] || [];
  if (dateFields.includes(fieldName)) {
    return parseDateValue(value);
  }
  return formatSqlValue(value);
}

// --- applyRestore ---

/**
 * Apply a restore from a backup snapshot.
 * 1. Acquire memory lock
 * 2. Generate preview to classify records
 * 3. Validate all conflicts have resolutions
 * 4. Execute INSERT/UPDATE in a single Prisma transaction (FK-safe order)
 * 5. Release lock in finally
 */
export async function applyRestore(
  snapshotName: string,
  conflictResolutions: ConflictResolution[]
): Promise<RestoreApplyResult> {
  // 1. Acquire lock
  if (!acquireRestoreLock()) {
    throw new Error("還原作業進行中");
  }

  try {
    // 2. Generate preview
    const preview = await generateRestorePreview(snapshotName);

    // 3. Collect all conflicts and validate resolutions
    const allConflicts: ConflictRecord[] = [];
    for (const table of preview.tables) {
      allConflicts.push(...table.conflicts);
    }

    // Build resolution lookup: "tableName:recordId" → resolution
    const resolutionMap = new Map<string, ConflictResolution>();
    for (const res of conflictResolutions) {
      resolutionMap.set(`${res.tableName}:${res.recordId}`, res);
    }

    // Validate: every conflict must have a resolution
    for (const conflict of allConflicts) {
      const key = `${conflict.tableName}:${conflict.id}`;
      if (!resolutionMap.has(key)) {
        throw new Error("尚有未解決的衝突記錄");
      }
    }

    // Also validate: no extra resolutions for non-existent conflicts
    const conflictKeys = new Set(allConflicts.map((c) => `${c.tableName}:${c.id}`));
    for (const res of conflictResolutions) {
      const key = `${res.tableName}:${res.recordId}`;
      if (!conflictKeys.has(key)) {
        throw new Error("尚有未解決的衝突記錄");
      }
    }

    // Build a map from tableName → TableRestorePreview for quick lookup
    const previewByTable = new Map<string, TableRestorePreview>();
    for (const table of preview.tables) {
      previewByTable.set(table.tableName, table);
    }

    // 4. Execute in a single interactive transaction
    const tableResults = await prisma.$transaction(async (tx) => {
      const results: TableApplyResult[] = [];

      for (const tableName of RESTORE_TABLE_ORDER) {
        const tablePreview = previewByTable.get(tableName);
        if (!tablePreview) {
          results.push({
            tableName,
            identicalCount: 0,
            insertedCount: 0,
            conflictResolvedCount: 0,
            deletedCount: 0,
          });
          continue;
        }

        const isManyToMany = MANY_TO_MANY_TABLES.includes(tableName);
        let insertedCount = 0;
        let conflictResolvedCount = 0;

        // --- INSERT new records ---
        for (const newRec of tablePreview.newRecords) {
          const data = newRec.data;

          if (isManyToMany) {
            // Many-to-many: INSERT with columns A, B — validate both FK targets exist
            const [colA, colB] = MANY_TO_MANY_COLUMNS[tableName];
            const valA = data[colA];
            const valB = data[colB];
            // Check both referenced records exist in the transaction
            const m2mFkTargets = MANY_TO_MANY_FK_TARGETS[tableName];
            let skipM2m = false;
            if (m2mFkTargets) {
              for (const [, targetTable, val] of [
                [colA, m2mFkTargets.A, valA],
                [colB, m2mFkTargets.B, valB],
              ] as [string, string, unknown][]) {
                if (val != null) {
                  const exists = await tx.$queryRawUnsafe(
                    `SELECT 1 FROM "${targetTable}" WHERE "id" = ${formatSqlValue(val)} LIMIT 1`
                  ) as unknown[];
                  if (exists.length === 0) {
                    skipM2m = true;
                    break;
                  }
                }
              }
            }
            if (!skipM2m) {
              const sql = `INSERT INTO "${tableName}" ("${colA}", "${colB}") VALUES (${formatSqlValue(valA)}, ${formatSqlValue(valB)})`;
              await tx.$executeRawUnsafe(sql);
              insertedCount++;
            }
          } else if (tableName === "users") {
            // Users: insert with random password hash
            const randomPassword = crypto.randomBytes(32).toString("hex");
            const fields = Object.keys(data);
            const allFields = [...fields, "password"];
            const columns = allFields.map((f) =>
              f === "password" ? `"password"` : `"${toColumnName(tableName, f)}"`
            ).join(", ");
            const values = allFields.map((f) => {
              if (f === "password") return formatSqlValue(randomPassword);
              return formatFieldValue(tableName, f, data[f]);
            }).join(", ");
            const sql = `INSERT INTO "users" (${columns}) VALUES (${values})`;
            await tx.$executeRawUnsafe(sql);
            insertedCount++;
          } else {
            // Regular table INSERT — validate FK references first
            const fields = Object.keys(data);
            const insertData: Record<string, unknown> = { ...data };

            // Check FK fields for dangling references
            const tableFks = FK_FIELDS[tableName];
            let skipInsert = false;
            if (tableFks) {
              for (const [fkField, fkDef] of Object.entries(tableFks)) {
                if (insertData[fkField] != null) {
                  const fkValue = insertData[fkField];
                  const existsResult = await tx.$queryRawUnsafe(
                    `SELECT 1 FROM "${fkDef.table}" WHERE "id" = ${formatSqlValue(fkValue)} LIMIT 1`
                  ) as unknown[];
                  if (existsResult.length === 0) {
                    if (fkDef.nullable) {
                      insertData[fkField] = null;
                    } else {
                      // Non-nullable FK target missing — cannot insert this record
                      skipInsert = true;
                      break;
                    }
                  }
                }
              }
            }

            if (!skipInsert) {
              const insertFields = Object.keys(insertData);
              const columns = insertFields
                .map((f) => `"${toColumnName(tableName, f)}"`)
                .join(", ");
              const values = insertFields
                .map((f) => formatFieldValue(tableName, f, insertData[f]))
                .join(", ");
              const sql = `INSERT INTO "${tableName}" (${columns}) VALUES (${values})`;
              await tx.$executeRawUnsafe(sql);
              insertedCount++;
            }
          }
        }

        // --- Resolve conflicts ---
        for (const conflict of tablePreview.conflicts) {
          const resKey = `${conflict.tableName}:${conflict.id}`;
          const resolution = resolutionMap.get(resKey)!;

          if (resolution.choice === "current") {
            // SKIP — keep current DB version
            conflictResolvedCount++;
            continue;
          }

          // choice === "backup" → UPDATE with backup data
          if (isManyToMany) {
            // Many-to-many tables have no fields to update beyond the composite key,
            // and since the key matches, there's nothing to change. Skip.
            conflictResolvedCount++;
            continue;
          }

          const backupData = conflict.backupData;
          const diffFields = conflict.diffFields;

          // Build SET clause — only update differing fields, never password
          const setClauses: string[] = [];
          for (const field of diffFields) {
            if (tableName === "users" && field === "password") continue;

            // Check if this field is a FK that needs dangling reference validation
            const fkDef = FK_FIELDS[tableName]?.[field];
            if (fkDef && backupData[field] != null) {
              const fkValue = backupData[field];
              const targetTable = fkDef.table;
              // Check if the target record exists in the DB (including records inserted earlier in this transaction)
              const existsResult = await tx.$queryRawUnsafe(
                `SELECT 1 FROM "${targetTable}" WHERE "id" = ${formatSqlValue(fkValue)} LIMIT 1`
              ) as unknown[];
              if (existsResult.length === 0) {
                // Target record does not exist
                if (fkDef.nullable) {
                  // Nullable FK: set to NULL instead of the dangling reference
                  const col = toColumnName(tableName, field);
                  setClauses.push(`"${col}" = NULL`);
                }
                // Non-nullable FK: skip this field entirely
                continue;
              }
            }

            const col = toColumnName(tableName, field);
            const val = formatFieldValue(tableName, field, backupData[field]);
            setClauses.push(`"${col}" = ${val}`);
          }

          if (setClauses.length > 0) {
            const sql = `UPDATE "${tableName}" SET ${setClauses.join(", ")} WHERE "id" = ${formatSqlValue(conflict.id)}`;
            await tx.$executeRawUnsafe(sql);
          }

          conflictResolvedCount++;
        }

        results.push({
          tableName,
          identicalCount: tablePreview.identical,
          insertedCount,
          conflictResolvedCount,
          deletedCount: tablePreview.deleted.length,
        });
      }

      return results;
    });

    return {
      success: true,
      tables: tableResults,
    };
  } finally {
    // 5. Always release lock
    releaseRestoreLock();
  }
}
