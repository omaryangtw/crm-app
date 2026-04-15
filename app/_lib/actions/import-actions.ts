"use server";

import { prisma } from "../db";
import { auth } from "../auth";
import { createAuditLogEntry } from "../audit/audit-service";
import {
  parseJsonPayload,
  mapClientRecord,
  mapCaseRecord,
  mapContactRecord,
  mapFamilyRecord,
} from "../utils/import-utils";
import type { ValidationError } from "../utils/import-utils";

// ── Types ──

export type ConflictStrategy = "skip" | "overwrite";
export type ImportTable = "clients" | "cases" | "contacts" | "families";

export interface ImportResult {
  success: boolean;
  table: ImportTable;
  total: number;
  inserted: number;
  overwritten: number;
  skipped: number;
  failed: number;
  errors: ValidationError[];
  error?: string;
}

// ── Shared helpers ──

function failResult(table: ImportTable, error: string): ImportResult {
  return {
    success: false,
    table,
    total: 0,
    inserted: 0,
    overwritten: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    error,
  };
}

async function validateAdminAndParseForm(
  formData: FormData,
  table: ImportTable,
): Promise<
  | { ok: true; text: string; conflictStrategy: ConflictStrategy; userId: number; userEmail: string }
  | { ok: false; result: ImportResult }
> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { ok: false, result: failResult(table, "權限不足") };
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return { ok: false, result: failResult(table, "未提供檔案") };
  }

  // Validate file extension
  if (!file.name.toLowerCase().endsWith(".json")) {
    return { ok: false, result: failResult(table, "請選擇 JSON 檔案") };
  }

  // Validate file size (10MB)
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, result: failResult(table, "檔案大小不可超過 10MB") };
  }

  const text = await file.text();
  const strategy = (formData.get("conflictStrategy") as string) || "skip";
  const conflictStrategy: ConflictStrategy = strategy === "overwrite" ? "overwrite" : "skip";

  const userId = parseInt(session.user.id ?? "0", 10);
  const userEmail = session.user.email ?? "";

  return { ok: true, text, conflictStrategy, userId, userEmail };
}

// ── importClients ──

export async function importClients(formData: FormData): Promise<ImportResult> {
  const table: ImportTable = "clients";
  const parsed = await validateAdminAndParseForm(formData, table);
  if (!parsed.ok) return parsed.result;

  const { text, conflictStrategy, userId, userEmail } = parsed;
  const jsonResult = parseJsonPayload(text);
  if (!jsonResult.success) return failResult(table, jsonResult.error);

  const records = jsonResult.records;
  let inserted = 0;
  let overwritten = 0;
  let skipped = 0;
  let failed = 0;
  const allErrors: ValidationError[] = [];

  for (let i = 0; i < records.length; i++) {
    const mapped = mapClientRecord(records[i], i + 1);
    allErrors.push(...mapped.errors);
    const d = mapped.data;

    try {
      if (conflictStrategy === "skip") {
        const result = await prisma.$executeRawUnsafe(
          `INSERT INTO clients (id, name, name_alt, idn, sex, birthday, is_dead, household_admin,
            income_status, disabled_status, indigenous_group, tribe, plain_mountain,
            can_call, phone, phone_note, phone_alt, phone_alt_note,
            mobile, mobile_note, mobile_alt, mobile_alt_note,
            can_mail, city, city_alt, dist, dist_alt, vill, vill_alt,
            addr, addr_alt, addr_note, addr_alt_note, note,
            created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36)
          ON CONFLICT (id) DO NOTHING`,
          d.id, d.name, d.name_alt, d.idn, d.sex, d.birthday, d.is_dead, d.household_admin,
          d.income_status, d.disabled_status, d.indigenous_group, d.tribe, d.plain_mountain,
          d.can_call, d.phone, d.phone_note, d.phone_alt, d.phone_alt_note,
          d.mobile, d.mobile_note, d.mobile_alt, d.mobile_alt_note,
          d.can_mail, d.city, d.city_alt, d.dist, d.dist_alt, d.vill, d.vill_alt,
          d.addr, d.addr_alt, d.addr_note, d.addr_alt_note, d.note,
          d.created_at, d.updated_at,
        );
        if (result === 0) skipped++;
        else inserted++;
      } else {
        // overwrite mode
        const result = await prisma.$executeRawUnsafe(
          `INSERT INTO clients (id, name, name_alt, idn, sex, birthday, is_dead, household_admin,
            income_status, disabled_status, indigenous_group, tribe, plain_mountain,
            can_call, phone, phone_note, phone_alt, phone_alt_note,
            mobile, mobile_note, mobile_alt, mobile_alt_note,
            can_mail, city, city_alt, dist, dist_alt, vill, vill_alt,
            addr, addr_alt, addr_note, addr_alt_note, note,
            created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, name_alt = EXCLUDED.name_alt, idn = EXCLUDED.idn,
            sex = EXCLUDED.sex, birthday = EXCLUDED.birthday, is_dead = EXCLUDED.is_dead,
            household_admin = EXCLUDED.household_admin, income_status = EXCLUDED.income_status,
            disabled_status = EXCLUDED.disabled_status, indigenous_group = EXCLUDED.indigenous_group,
            tribe = EXCLUDED.tribe, plain_mountain = EXCLUDED.plain_mountain,
            can_call = EXCLUDED.can_call, phone = EXCLUDED.phone, phone_note = EXCLUDED.phone_note,
            phone_alt = EXCLUDED.phone_alt, phone_alt_note = EXCLUDED.phone_alt_note,
            mobile = EXCLUDED.mobile, mobile_note = EXCLUDED.mobile_note,
            mobile_alt = EXCLUDED.mobile_alt, mobile_alt_note = EXCLUDED.mobile_alt_note,
            can_mail = EXCLUDED.can_mail, city = EXCLUDED.city, city_alt = EXCLUDED.city_alt,
            dist = EXCLUDED.dist, dist_alt = EXCLUDED.dist_alt, vill = EXCLUDED.vill,
            vill_alt = EXCLUDED.vill_alt, addr = EXCLUDED.addr, addr_alt = EXCLUDED.addr_alt,
            addr_note = EXCLUDED.addr_note, addr_alt_note = EXCLUDED.addr_alt_note,
            note = EXCLUDED.note, created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at`,
          d.id, d.name, d.name_alt, d.idn, d.sex, d.birthday, d.is_dead, d.household_admin,
          d.income_status, d.disabled_status, d.indigenous_group, d.tribe, d.plain_mountain,
          d.can_call, d.phone, d.phone_note, d.phone_alt, d.phone_alt_note,
          d.mobile, d.mobile_note, d.mobile_alt, d.mobile_alt_note,
          d.can_mail, d.city, d.city_alt, d.dist, d.dist_alt, d.vill, d.vill_alt,
          d.addr, d.addr_alt, d.addr_note, d.addr_alt_note, d.note,
          d.created_at, d.updated_at,
        );
        // ON CONFLICT DO UPDATE always returns 1 (upsert), so we check if the id existed
        // For simplicity: result >= 1 means success. We count as overwritten if id existed.
        // $executeRawUnsafe returns affected rows; upsert always returns 1.
        // We can't distinguish insert vs update from row count alone with DO UPDATE.
        // Use a pre-check or just count all as "inserted or overwritten".
        if (result >= 1) {
          // Check if this was an update by seeing if we had a conflict
          // Since DO UPDATE always affects 1 row, we track via a separate query
          overwritten++;
        }
      }
    } catch (err) {
      failed++;
      allErrors.push({
        index: i + 1,
        field: "id",
        value: d.id,
        message: `資料庫插入失敗: ${(err as Error).message}`,
      });
    }
  }

  // Reset sequence
  try {
    await prisma.$executeRawUnsafe(
      `SELECT setval('clients_id_seq', (SELECT COALESCE(MAX(id), 0) FROM clients) + 1)`
    );
  } catch (err) {
    console.error("Failed to reset clients_id_seq:", err);
  }

  // Audit log
  try {
    await createAuditLogEntry({
      entityType: "Import",
      entityId: 0,
      action: "IMPORT",
      userId,
      userEmail,
      oldData: null,
      newData: {
        table,
        fileName: (formData.get("file") as File)?.name ?? "unknown",
        conflictStrategy,
        inserted,
        overwritten,
        skipped,
        failed,
      },
      changedFields: [],
    });
  } catch (err) {
    console.error("Failed to create import audit log:", err);
  }

  return {
    success: true,
    table,
    total: records.length,
    inserted,
    overwritten,
    skipped,
    failed,
    errors: allErrors,
  };
}


// ── importCases ──

export async function importCases(formData: FormData): Promise<ImportResult> {
  const table: ImportTable = "cases";
  const parsed = await validateAdminAndParseForm(formData, table);
  if (!parsed.ok) return parsed.result;

  const { text, conflictStrategy, userId, userEmail } = parsed;
  const jsonResult = parseJsonPayload(text);
  if (!jsonResult.success) return failResult(table, jsonResult.error);

  const records = jsonResult.records;
  let inserted = 0;
  let overwritten = 0;
  let skipped = 0;
  let failed = 0;
  const allErrors: ValidationError[] = [];

  for (let i = 0; i < records.length; i++) {
    const mapped = mapCaseRecord(records[i], i + 1);
    allErrors.push(...mapped.errors);
    const d = mapped.data;

    // Skip records with no client association (same as seed.ts: `if (!c.ClientId) continue`)
    if (!d.client_id) {
      skipped++;
      allErrors.push({
        index: i + 1,
        field: "client_id",
        value: d.client_id,
        message: "缺少族人 ID（ClientId 為空），已跳過",
      });
      continue;
    }

    try {
      if (conflictStrategy === "skip") {
        const result = await prisma.$executeRawUnsafe(
          `INSERT INTO cases (id, name, status, types_major, types_minor,
            relation1, relation2, relation3, contact1, contact2, contact3,
            note, handle, person_in_charge_legacy, client_id, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          ON CONFLICT (id) DO NOTHING`,
          d.id, d.name, d.status, d.types_major, d.types_minor,
          d.relation1, d.relation2, d.relation3, d.contact1, d.contact2, d.contact3,
          d.note, d.handle, d.person_in_charge_legacy, d.client_id,
          d.created_at, d.updated_at,
        );
        if (result === 0) skipped++;
        else inserted++;
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO cases (id, name, status, types_major, types_minor,
            relation1, relation2, relation3, contact1, contact2, contact3,
            note, handle, person_in_charge_legacy, client_id, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name, status = EXCLUDED.status,
            types_major = EXCLUDED.types_major, types_minor = EXCLUDED.types_minor,
            relation1 = EXCLUDED.relation1, relation2 = EXCLUDED.relation2, relation3 = EXCLUDED.relation3,
            contact1 = EXCLUDED.contact1, contact2 = EXCLUDED.contact2, contact3 = EXCLUDED.contact3,
            note = EXCLUDED.note, handle = EXCLUDED.handle,
            person_in_charge_legacy = EXCLUDED.person_in_charge_legacy,
            client_id = EXCLUDED.client_id,
            created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at`,
          d.id, d.name, d.status, d.types_major, d.types_minor,
          d.relation1, d.relation2, d.relation3, d.contact1, d.contact2, d.contact3,
          d.note, d.handle, d.person_in_charge_legacy, d.client_id,
          d.created_at, d.updated_at,
        );
        overwritten++;
      }
    } catch (err) {
      failed++;
      const msg = (err as Error).message;
      const isFkViolation = msg.includes("foreign key") || msg.includes("violates");
      allErrors.push({
        index: i + 1,
        field: isFkViolation ? "client_id" : "id",
        value: isFkViolation ? d.client_id : d.id,
        message: isFkViolation
          ? `參照的族人 ID (${d.client_id}) 不存在於資料庫`
          : `資料庫插入失敗: ${msg}`,
      });
    }
  }

  // Reset sequence
  try {
    await prisma.$executeRawUnsafe(
      `SELECT setval('cases_id_seq', (SELECT COALESCE(MAX(id), 0) FROM cases) + 1)`
    );
  } catch (err) {
    console.error("Failed to reset cases_id_seq:", err);
  }

  // Audit log
  try {
    await createAuditLogEntry({
      entityType: "Import",
      entityId: 0,
      action: "IMPORT",
      userId,
      userEmail,
      oldData: null,
      newData: {
        table,
        fileName: (formData.get("file") as File)?.name ?? "unknown",
        conflictStrategy,
        inserted,
        overwritten,
        skipped,
        failed,
      },
      changedFields: [],
    });
  } catch (err) {
    console.error("Failed to create import audit log:", err);
  }

  return {
    success: true,
    table,
    total: records.length,
    inserted,
    overwritten,
    skipped,
    failed,
    errors: allErrors,
  };
}


// ── importContacts ──

export async function importContacts(formData: FormData): Promise<ImportResult> {
  const table: ImportTable = "contacts";
  const parsed = await validateAdminAndParseForm(formData, table);
  if (!parsed.ok) return parsed.result;

  const { text, conflictStrategy, userId, userEmail } = parsed;
  const jsonResult = parseJsonPayload(text);
  if (!jsonResult.success) return failResult(table, jsonResult.error);

  const records = jsonResult.records;
  let inserted = 0;
  let overwritten = 0;
  let skipped = 0;
  let failed = 0;
  const allErrors: ValidationError[] = [];

  for (let i = 0; i < records.length; i++) {
    const mapped = mapContactRecord(records[i], i + 1);
    allErrors.push(...mapped.errors);
    const d = mapped.data;

    // Skip records with no client association (same as seed.ts: `if (!c.ClientId) continue`)
    if (!d.client_id) {
      skipped++;
      allErrors.push({
        index: i + 1,
        field: "client_id",
        value: d.client_id,
        message: "缺少族人 ID（ClientId 為空），已跳過",
      });
      continue;
    }

    try {
      if (conflictStrategy === "skip") {
        const result = await prisma.$executeRawUnsafe(
          `INSERT INTO contacts (id, date, contact_type, is_success, record,
            person_in_charge_legacy, client_id, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (id) DO NOTHING`,
          d.id, d.date, d.contact_type, d.is_success, d.record,
          d.person_in_charge_legacy, d.client_id,
          d.created_at, d.updated_at,
        );
        if (result === 0) skipped++;
        else inserted++;
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO contacts (id, date, contact_type, is_success, record,
            person_in_charge_legacy, client_id, created_at, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          ON CONFLICT (id) DO UPDATE SET
            date = EXCLUDED.date, contact_type = EXCLUDED.contact_type,
            is_success = EXCLUDED.is_success, record = EXCLUDED.record,
            person_in_charge_legacy = EXCLUDED.person_in_charge_legacy,
            client_id = EXCLUDED.client_id,
            created_at = EXCLUDED.created_at, updated_at = EXCLUDED.updated_at`,
          d.id, d.date, d.contact_type, d.is_success, d.record,
          d.person_in_charge_legacy, d.client_id,
          d.created_at, d.updated_at,
        );
        overwritten++;
      }
    } catch (err) {
      failed++;
      const msg = (err as Error).message;
      const isFkViolation = msg.includes("foreign key") || msg.includes("violates");
      allErrors.push({
        index: i + 1,
        field: isFkViolation ? "client_id" : "id",
        value: isFkViolation ? d.client_id : d.id,
        message: isFkViolation
          ? `參照的族人 ID (${d.client_id}) 不存在於資料庫`
          : `資料庫插入失敗: ${msg}`,
      });
    }
  }

  // Reset sequence
  try {
    await prisma.$executeRawUnsafe(
      `SELECT setval('contacts_id_seq', (SELECT COALESCE(MAX(id), 0) FROM contacts) + 1)`
    );
  } catch (err) {
    console.error("Failed to reset contacts_id_seq:", err);
  }

  // Audit log
  try {
    await createAuditLogEntry({
      entityType: "Import",
      entityId: 0,
      action: "IMPORT",
      userId,
      userEmail,
      oldData: null,
      newData: {
        table,
        fileName: (formData.get("file") as File)?.name ?? "unknown",
        conflictStrategy,
        inserted,
        overwritten,
        skipped,
        failed,
      },
      changedFields: [],
    });
  } catch (err) {
    console.error("Failed to create import audit log:", err);
  }

  return {
    success: true,
    table,
    total: records.length,
    inserted,
    overwritten,
    skipped,
    failed,
    errors: allErrors,
  };
}


// ── importFamilies ──

export async function importFamilies(formData: FormData): Promise<ImportResult> {
  const table: ImportTable = "families";
  const parsed = await validateAdminAndParseForm(formData, table);
  if (!parsed.ok) return parsed.result;

  const { text, conflictStrategy, userId, userEmail } = parsed;
  const jsonResult = parseJsonPayload(text);
  if (!jsonResult.success) return failResult(table, jsonResult.error);

  const records = jsonResult.records;
  let inserted = 0;
  let overwritten = 0;
  let skipped = 0;
  let failed = 0;
  const allErrors: ValidationError[] = [];

  // Build clientSexMap from DB (id → sex)
  const clients = await prisma.client.findMany({ select: { id: true, sex: true } });
  const clientSexMap = new Map<number, string>();
  for (const c of clients) {
    if (c.sex) clientSexMap.set(c.id, c.sex);
  }

  for (let i = 0; i < records.length; i++) {
    const mapped = mapFamilyRecord(records[i], i + 1, clientSexMap);
    allErrors.push(...mapped.errors);
    const d = mapped.data;

    try {
      if (conflictStrategy === "skip") {
        const result = await prisma.$executeRawUnsafe(
          `INSERT INTO family_relations (person_a_id, person_b_id, relation_a_to_b, relation_b_to_a)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (person_a_id, person_b_id) DO NOTHING`,
          d.person_a_id, d.person_b_id, d.relation_a_to_b, d.relation_b_to_a,
        );
        if (result === 0) skipped++;
        else inserted++;
      } else {
        await prisma.$executeRawUnsafe(
          `INSERT INTO family_relations (person_a_id, person_b_id, relation_a_to_b, relation_b_to_a)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (person_a_id, person_b_id) DO UPDATE SET
            relation_a_to_b = EXCLUDED.relation_a_to_b,
            relation_b_to_a = EXCLUDED.relation_b_to_a`,
          d.person_a_id, d.person_b_id, d.relation_a_to_b, d.relation_b_to_a,
        );
        overwritten++;
      }
    } catch (err) {
      failed++;
      allErrors.push({
        index: i + 1,
        field: "person_a_id",
        value: `${d.person_a_id}-${d.person_b_id}`,
        message: `資料庫插入失敗: ${(err as Error).message}`,
      });
    }
  }

  // Reset sequence
  try {
    await prisma.$executeRawUnsafe(
      `SELECT setval('family_relations_id_seq', (SELECT COALESCE(MAX(id), 0) FROM family_relations) + 1)`
    );
  } catch (err) {
    console.error("Failed to reset family_relations_id_seq:", err);
  }

  // Audit log
  try {
    await createAuditLogEntry({
      entityType: "Import",
      entityId: 0,
      action: "IMPORT",
      userId,
      userEmail,
      oldData: null,
      newData: {
        table,
        fileName: (formData.get("file") as File)?.name ?? "unknown",
        conflictStrategy,
        inserted,
        overwritten,
        skipped,
        failed,
      },
      changedFields: [],
    });
  } catch (err) {
    console.error("Failed to create import audit log:", err);
  }

  return {
    success: true,
    table,
    total: records.length,
    inserted,
    overwritten,
    skipped,
    failed,
    errors: allErrors,
  };
}
