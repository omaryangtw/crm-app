import Papa from "papaparse";
import { type ExportQuery } from "../schemas/export-schema";

// Prisma WHERE clause type (simplified for our use case)
type PrismaWhere = Record<string, unknown>;

/**
 * Build a Prisma WHERE clause from an ExportQuery.
 * Pure function — no DB access, just data transformation.
 */
export function buildExportWhereClause(query: ExportQuery = {}): PrismaWhere {
  const conditions: PrismaWhere[] = [];

  // Boolean filters
  if (query.isDead !== undefined) {
    conditions.push({ isDead: query.isDead });
  }
  if (query.canCall !== undefined) {
    conditions.push({ canCall: query.canCall });
  }
  if (query.canMail !== undefined) {
    conditions.push({ canMail: query.canMail });
  }
  if (query.householdAdmin !== undefined) {
    conditions.push({ householdAdmin: query.householdAdmin });
  }

  // Sex filter
  if (query.sex) {
    conditions.push({ sex: query.sex });
  }

  // "any" means non-null; specific value means exact match
  if (query.disabledStatus) {
    if (query.disabledStatus === "any") {
      conditions.push({ disabledStatus: { not: null } });
    } else {
      conditions.push({ disabledStatus: query.disabledStatus });
    }
  }

  if (query.incomeStatus) {
    if (query.incomeStatus === "any") {
      conditions.push({ incomeStatus: { not: null } });
    } else {
      conditions.push({ incomeStatus: query.incomeStatus });
    }
  }

  if (query.group) {
    if (query.group === "any") {
      conditions.push({ indigenousGroup: { not: null } });
    } else {
      conditions.push({ indigenousGroup: query.group });
    }
  }

  if (query.plainMountain) {
    if (query.plainMountain === "any") {
      conditions.push({ plainMountain: { not: null } });
    } else {
      conditions.push({ plainMountain: query.plainMountain });
    }
  }

  // Age range — computed from birthday using date arithmetic
  if (query.ageMin !== undefined) {
    const maxBirthday = new Date();
    maxBirthday.setFullYear(maxBirthday.getFullYear() - query.ageMin);
    conditions.push({ birthday: { lte: maxBirthday } });
  }
  if (query.ageMax !== undefined) {
    const minBirthday = new Date();
    minBirthday.setFullYear(minBirthday.getFullYear() - query.ageMax - 1);
    // Add one day to make it inclusive
    minBirthday.setDate(minBirthday.getDate() + 1);
    conditions.push({ birthday: { gte: minBirthday } });
  }

  // Partial match (contains, case-insensitive) for string fields
  const partialMatchFields: Array<{ key: keyof ExportQuery; dbField: string }> = [
    { key: "city", dbField: "city" },
    { key: "dist", dbField: "dist" },
    { key: "name", dbField: "name" },
    { key: "nameAlt", dbField: "nameAlt" },
    { key: "tribe", dbField: "tribe" },
    { key: "vill", dbField: "vill" },
    { key: "note", dbField: "note" },
  ];

  for (const { key, dbField } of partialMatchFields) {
    const value = query[key];
    if (typeof value === "string" && value.length > 0) {
      conditions.push({
        [dbField]: { contains: value, mode: "insensitive" },
      });
    }
  }

  if (conditions.length === 0) return {};
  return { AND: conditions };
}

/** Preset configurations — data, not code */
export const EXPORT_PRESETS = {
  householdMailing: {
    filters: {
      isDead: false,
      canMail: true,
      householdAdmin: true,
      plainMountain: "plain" as const,
      city: "臺南市",
    },
    columns: ["name", "city", "dist", "vill", "addr"],
    groupBy: "addr",
  },
  smsList: {
    filters: {
      isDead: false,
      canCall: true,
      plainMountain: "plain" as const,
    },
    columns: ["name", "mobile"],
    groupBy: "mobile",
  },
  googleContacts: {
    flag: "contacts" as const,
  },
} as const;

/**
 * Generate CSV string from data rows and column definitions.
 */
export function generateCsv(
  data: Record<string, unknown>[],
  columns: string[]
): string {
  const projected = projectColumns(data, columns);
  return Papa.unparse(projected, { columns });
}

/**
 * Select only specified columns from each record.
 */
export function projectColumns(
  records: Record<string, unknown>[],
  columns: string[]
): Record<string, unknown>[] {
  return records.map((record) => {
    const projected: Record<string, unknown> = {};
    for (const col of columns) {
      projected[col] = record[col] ?? null;
    }
    return projected;
  });
}
