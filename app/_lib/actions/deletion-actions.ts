"use server";

import { revalidatePath } from "next/cache";
import { Prisma, DeletionRequestStatus } from "@prisma/client";
import { prisma } from "../db";
import { auth } from "../auth";
import { createAuditLogEntry } from "../audit/audit-service";
import { buildEntitySnapshot } from "../utils/snapshot-builder";
import { getCascadeImpact } from "../utils/cascade-impact";
import type { CascadeImpact } from "../utils/cascade-impact";
import type { ActionResult } from "./auth-actions";
import type { EntityType } from "../audit/audit-types";
import type { CascadeEntityType } from "../utils/snapshot-builder";

export interface RequestDeletionParams {
  entityType: EntityType;
  entityId: number;
  cascadeSelection?: CascadeEntityType[];
}

export interface DeletionRequestWithLabel {
  id: number;
  entityType: string;
  entityId: number;
  status: DeletionRequestStatus;
  entitySnapshot: Prisma.JsonValue;
  cascadeSelection: Prisma.JsonValue;
  requesterId: number;
  requesterEmail: string;
  reviewerId: number | null;
  reviewerEmail: string | null;
  reviewedAt: Date | null;
  restoredAt: Date | null;
  restoredById: number | null;
  createdAt: Date;
  updatedAt: Date;
  entityLabel: string;
}

export interface GetDeletionRequestsResult {
  requests: DeletionRequestWithLabel[];
  total: number;
}

/** Thin server action wrapper so client components can call getCascadeImpact. */
export async function getCascadeImpactAction(
  entityType: EntityType,
  entityId: number
): Promise<ActionResult<CascadeImpact>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "請先登入" };

  try {
    const impact = await getCascadeImpact(entityType, entityId);
    return { success: true, data: impact };
  } catch {
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

export async function requestDeletion(
  params: RequestDeletionParams
): Promise<ActionResult<{ id: number }>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "請先登入" };

  const { entityType, entityId, cascadeSelection = [] } = params;
  const userId = parseInt(session.user.id ?? "0", 10);
  const userEmail = session.user.email ?? "";

  // Verify entity exists
  const entity = await findEntity(entityType, entityId);
  if (!entity) return { success: false, error: "找不到資料" };

  // Check for existing pending request
  const existingPending = await prisma.deletionRequest.findFirst({
    where: { entityType, entityId, status: "pending" },
  });
  if (existingPending) {
    return { success: false, error: "此資料已有待審核的刪除申請" };
  }

  // Build entity snapshot
  const snapshot = await buildEntitySnapshot(entityType, entityId, cascadeSelection);

  try {
    const deletionRequest = await prisma.deletionRequest.create({
      data: {
        entityType,
        entityId,
        status: "pending",
        entitySnapshot: (snapshot ?? {}) as Prisma.InputJsonValue,
        cascadeSelection: cascadeSelection as Prisma.InputJsonValue,
        requesterId: userId,
        requesterEmail: userEmail,
      },
    });

    // Audit log — failure must not affect primary operation
    try {
      const entityData = snapshot?.entity as Record<string, unknown> | undefined;
      await createAuditLogEntry({
        entityType,
        entityId,
        action: "DELETE_REQUESTED",
        userId,
        userEmail,
        oldData: entityData ?? null,
        newData: null,
        changedFields: [],
      });
    } catch {
      // Audit failure must not affect CRUD result
    }

    revalidatePath("/clients");
    revalidatePath("/cases");
    revalidatePath("/contacts");
    revalidatePath("/admin/deletion-requests");

    return { success: true, data: { id: deletionRequest.id } };
  } catch {
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

async function findEntity(
  entityType: EntityType,
  entityId: number
): Promise<unknown | null> {
  switch (entityType) {
    case "Client":
      return prisma.client.findUnique({ where: { id: entityId } });
    case "Case":
      return prisma.case.findUnique({ where: { id: entityId } });
    case "Contact":
      return prisma.contact.findUnique({ where: { id: entityId } });
  }
}


export async function getDeletionRequests(params: {
  status?: DeletionRequestStatus;
  page?: number;
  pageSize?: number;
}): Promise<ActionResult<GetDeletionRequestsResult>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "請先登入" };
  if (session.user.role !== "admin") return { success: false, error: "權限不足" };

  const { status, page = 1, pageSize = 20 } = params;
  const skip = (page - 1) * pageSize;

  const where: Prisma.DeletionRequestWhereInput = status ? { status } : {};

  const [requests, total] = await Promise.all([
    prisma.deletionRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.deletionRequest.count({ where }),
  ]);

  // Resolve entity labels — use DB first, fall back to entitySnapshot if entity was deleted
  const requestsWithLabels: DeletionRequestWithLabel[] = await Promise.all(
    requests.map(async (req) => ({
      ...req,
      entityLabel: await resolveEntityLabel(
        req.entityType as EntityType,
        req.entityId,
        req.entitySnapshot as Record<string, unknown> | null
      ),
    }))
  );

  return { success: true, data: { requests: requestsWithLabels, total } };
}

async function resolveEntityLabel(
  entityType: EntityType,
  entityId: number,
  entitySnapshot?: Record<string, unknown> | null
): Promise<string> {
  // Helper: extract name from entitySnapshot.entity
  function labelFromSnapshot(): string | null {
    const entity = entitySnapshot?.entity as Record<string, unknown> | undefined;
    if (!entity) return null;
    if (entityType === "Client" || entityType === "Case") {
      const name = entity.name;
      if (typeof name === "string" && name) return name;
    }
    if (entityType === "Contact") {
      const date = entity.date;
      const contactType = entity.contactType;
      const datePart = typeof date === "string" ? date.slice(0, 10) : "無日期";
      const typePart = typeof contactType === "string" ? contactType : "";
      const label = `${datePart} ${typePart}`.trim();
      return label || null;
    }
    return null;
  }

  try {
    switch (entityType) {
      case "Client": {
        const client = await prisma.client.findUnique({
          where: { id: entityId },
          select: { name: true },
        });
        return client?.name ?? labelFromSnapshot() ?? `Client #${entityId}`;
      }
      case "Case": {
        const caseRecord = await prisma.case.findUnique({
          where: { id: entityId },
          select: { name: true },
        });
        return caseRecord?.name ?? labelFromSnapshot() ?? `Case #${entityId}`;
      }
      case "Contact": {
        const contact = await prisma.contact.findUnique({
          where: { id: entityId },
          select: { date: true, contactType: true, record: true },
        });
        if (contact) {
          const datePart = contact.date
            ? contact.date.toISOString().slice(0, 10)
            : "無日期";
          const typePart = contact.contactType ?? "";
          return `${datePart} ${typePart}`.trim() || `Contact #${entityId}`;
        }
        return labelFromSnapshot() ?? `Contact #${entityId}`;
      }
      default:
        return labelFromSnapshot() ?? `${entityType} #${entityId}`;
    }
  } catch {
    return labelFromSnapshot() ?? `${entityType} #${entityId}`;
  }
}

export async function approveDeletion(
  requestId: number
): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "請先登入" };
  if (session.user.role !== "admin") return { success: false, error: "權限不足" };

  const userId = parseInt(session.user.id ?? "0", 10);
  const userEmail = session.user.email ?? "";

  // Find the deletion request
  const deletionRequest = await prisma.deletionRequest.findUnique({
    where: { id: requestId },
  });
  if (!deletionRequest) return { success: false, error: "找不到刪除申請" };

  // Verify status is pending
  if (deletionRequest.status !== "pending") {
    return { success: false, error: "此申請狀態不允許此操作" };
  }

  const entityType = deletionRequest.entityType as EntityType;
  const entityId = deletionRequest.entityId;

  try {
    // Check if entity still exists
    const entity = await findEntity(entityType, entityId);

    await prisma.$transaction(async (tx) => {
      // Delete entity if it still exists; cascade handles related records
      if (entity) {
        switch (entityType) {
          case "Client":
            await tx.client.delete({ where: { id: entityId } });
            break;
          case "Case":
            await tx.case.delete({ where: { id: entityId } });
            break;
          case "Contact":
            await tx.contact.delete({ where: { id: entityId } });
            break;
        }
      } else {
        console.warn(
          `Entity ${entityType} #${entityId} already deleted at approval time`
        );
      }

      // Update DeletionRequest status to approved
      await tx.deletionRequest.update({
        where: { id: requestId },
        data: {
          status: "approved",
          reviewerId: userId,
          reviewerEmail: userEmail,
          reviewedAt: new Date(),
        },
      });
    });

    // Audit log — failure must not affect primary operation
    try {
      const snapshot = deletionRequest.entitySnapshot as Record<string, unknown> | null;
      const oldData = snapshot && typeof snapshot === "object" && "entity" in snapshot
        ? (snapshot.entity as Record<string, unknown>)
        : null;

      await createAuditLogEntry({
        entityType,
        entityId,
        action: "DELETE",
        userId,
        userEmail,
        oldData,
        newData: null,
        changedFields: [],
      });
    } catch {
      // Audit failure must not affect CRUD result
    }

    revalidatePath("/clients");
    revalidatePath("/cases");
    revalidatePath("/contacts");
    revalidatePath("/admin/deletion-requests");

    return { success: true, data: null };
  } catch {
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

export async function rejectDeletion(
  requestId: number
): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "請先登入" };
  if (session.user.role !== "admin") return { success: false, error: "權限不足" };

  const userId = parseInt(session.user.id ?? "0", 10);
  const userEmail = session.user.email ?? "";

  // Find the deletion request
  const deletionRequest = await prisma.deletionRequest.findUnique({
    where: { id: requestId },
  });
  if (!deletionRequest) return { success: false, error: "找不到刪除申請" };

  // Verify status is pending
  if (deletionRequest.status !== "pending") {
    return { success: false, error: "此申請狀態不允許此操作" };
  }

  const entityType = deletionRequest.entityType as EntityType;
  const entityId = deletionRequest.entityId;

  try {
    // Update DeletionRequest status to rejected
    await prisma.deletionRequest.update({
      where: { id: requestId },
      data: {
        status: "rejected",
        reviewerId: userId,
        reviewerEmail: userEmail,
        reviewedAt: new Date(),
      },
    });

    // Audit log — failure must not affect primary operation
    try {
      await createAuditLogEntry({
        entityType,
        entityId,
        action: "DELETE_REJECTED",
        userId,
        userEmail,
        oldData: null,
        newData: null,
        changedFields: [],
      });
    } catch {
      // Audit failure must not affect CRUD result
    }

    revalidatePath("/clients");
    revalidatePath("/cases");
    revalidatePath("/contacts");
    revalidatePath("/admin/deletion-requests");

    return { success: true, data: null };
  } catch {
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}


// ── Column mapping: Prisma camelCase field → actual DB column name ──
// These maps are derived from the @map() annotations in schema.prisma.

const CLIENT_COLUMN_MAP: Record<string, string> = {
  id: "id",
  name: "name",
  nameAlt: "name_alt",
  idn: "idn",
  sex: "sex",
  birthday: "birthday",
  isDead: "is_dead",
  householdAdmin: "household_admin",
  incomeStatus: "income_status",
  disabledStatus: "disabled_status",
  indigenousGroup: "indigenous_group",
  tribe: "tribe",
  plainMountain: "plain_mountain",
  canCall: "can_call",
  phone: "phone",
  phoneNote: "phone_note",
  phoneAlt: "phone_alt",
  phoneAltNote: "phone_alt_note",
  mobile: "mobile",
  mobileNote: "mobile_note",
  mobileAlt: "mobile_alt",
  mobileAltNote: "mobile_alt_note",
  canMail: "can_mail",
  city: "city",
  cityAlt: "city_alt",
  dist: "dist",
  distAlt: "dist_alt",
  vill: "vill",
  villAlt: "vill_alt",
  addr: "addr",
  addrAlt: "addr_alt",
  addrNote: "addr_note",
  addrAltNote: "addr_alt_note",
  note: "note",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

const CASE_COLUMN_MAP: Record<string, string> = {
  id: "id",
  name: "name",
  status: "status",
  personInChargeLegacy: "person_in_charge_legacy",
  typesMajor: "types_major",
  typesMinor: "types_minor",
  relation1: "relation1",
  relation2: "relation2",
  relation3: "relation3",
  contact1: "contact1",
  contact2: "contact2",
  contact3: "contact3",
  note: "note",
  handle: "handle",
  clientId: "client_id",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

const CONTACT_COLUMN_MAP: Record<string, string> = {
  id: "id",
  date: "date",
  contactType: "contact_type",
  isSuccess: "is_success",
  record: "record",
  personInChargeLegacy: "person_in_charge_legacy",
  clientId: "client_id",
  caseId: "case_id",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

const TODO_COLUMN_MAP: Record<string, string> = {
  id: "id",
  date: "date",
  done: "done",
  note: "note",
  clientId: "client_id",
  createdAt: "created_at",
  updatedAt: "updated_at",
};

const FAMILY_RELATION_COLUMN_MAP: Record<string, string> = {
  id: "id",
  personAId: "person_a_id",
  personBId: "person_b_id",
  relationAToB: "relation_a_to_b",
  relationBToA: "relation_b_to_a",
};

const CLIENT_PHOTO_COLUMN_MAP: Record<string, string> = {
  id: "id",
  clientId: "client_id",
  photoPath: "photo_path",
  originalPhotoPath: "original_photo_path",
  version: "version",
  createdAt: "created_at",
};

// Date-type columns that need ISO string → timestamp conversion in SQL
const DATE_COLUMNS = new Set([
  "birthday",
  "date",
  "created_at",
  "updated_at",
]);

function getTableAndColumnMap(entityType: string): {
  table: string;
  columnMap: Record<string, string>;
} {
  switch (entityType) {
    case "Client":
      return { table: "clients", columnMap: CLIENT_COLUMN_MAP };
    case "Case":
      return { table: "cases", columnMap: CASE_COLUMN_MAP };
    case "Contact":
      return { table: "contacts", columnMap: CONTACT_COLUMN_MAP };
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

function getRelatedTableAndColumnMap(relatedType: string): {
  table: string;
  columnMap: Record<string, string>;
} {
  switch (relatedType) {
    case "cases":
      return { table: "cases", columnMap: CASE_COLUMN_MAP };
    case "contacts":
      return { table: "contacts", columnMap: CONTACT_COLUMN_MAP };
    case "todos":
      return { table: "todos", columnMap: TODO_COLUMN_MAP };
    case "familyRelations":
      return { table: "family_relations", columnMap: FAMILY_RELATION_COLUMN_MAP };
    case "photos":
      return { table: "client_photos", columnMap: CLIENT_PHOTO_COLUMN_MAP };
    default:
      throw new Error(`Unknown related type: ${relatedType}`);
  }
}

/**
 * Builds a raw SQL INSERT statement from a snapshot record and column map.
 * Returns [sql, params] where sql has $1, $2, ... placeholders.
 */
function buildInsertSql(
  table: string,
  record: Record<string, unknown>,
  columnMap: Record<string, string>
): [string, unknown[]] {
  const columns: string[] = [];
  const placeholders: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [prismaField, dbColumn] of Object.entries(columnMap)) {
    if (!(prismaField in record)) continue;
    const value = record[prismaField];

    columns.push(`"${dbColumn}"`);

    if (value !== null && DATE_COLUMNS.has(dbColumn)) {
      // Convert ISO string to timestamp via SQL cast
      placeholders.push(`$${idx}::timestamp`);
    } else {
      placeholders.push(`$${idx}`);
    }

    values.push(value ?? null);
    idx++;
  }

  const sql = `INSERT INTO "${table}" (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`;
  return [sql, values];
}

/**
 * Resets the auto-increment sequence for a table to MAX(id).
 */
function buildResetSequenceSql(table: string): string {
  return `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), (SELECT COALESCE(MAX(id), 0) FROM "${table}"))`;
}

export async function restoreDeletion(
  requestId: number
): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session?.user) return { success: false, error: "請先登入" };
  if (session.user.role !== "admin") return { success: false, error: "權限不足" };

  const userId = parseInt(session.user.id ?? "0", 10);
  const userEmail = session.user.email ?? "";

  // Find the deletion request
  const deletionRequest = await prisma.deletionRequest.findUnique({
    where: { id: requestId },
  });
  if (!deletionRequest) return { success: false, error: "找不到刪除申請" };

  // Verify status is approved
  if (deletionRequest.status !== "approved") {
    return { success: false, error: "此申請狀態不允許此操作" };
  }

  const entityType = deletionRequest.entityType as EntityType;
  const entityId = deletionRequest.entityId;

  // Check for ID conflict — entity with same ID already exists
  const existing = await findEntity(entityType, entityId);
  if (existing) {
    return { success: false, error: "資料 ID 衝突，無法還原" };
  }

  // Parse snapshot
  const snapshot = deletionRequest.entitySnapshot as {
    entity?: Record<string, unknown>;
    relatedRecords?: Record<string, Record<string, unknown>[]>;
  } | null;

  if (!snapshot?.entity) {
    return { success: false, error: "快照資料不完整，無法還原" };
  }

  const { table, columnMap } = getTableAndColumnMap(entityType);

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Re-create main entity via raw SQL INSERT with explicit ID
      const [entitySql, entityParams] = buildInsertSql(
        table,
        snapshot.entity!,
        columnMap
      );
      await tx.$executeRawUnsafe(entitySql, ...entityParams);

      // 2. Reset sequence for main entity table
      await tx.$executeRawUnsafe(buildResetSequenceSql(table));

      // 3. Re-create selected related records from snapshot
      const tablesNeedingSequenceReset = new Set<string>();

      if (snapshot.relatedRecords) {
        for (const [relatedKey, records] of Object.entries(
          snapshot.relatedRecords
        )) {
          if (!Array.isArray(records) || records.length === 0) continue;

          const { table: relatedTable, columnMap: relatedColumnMap } =
            getRelatedTableAndColumnMap(relatedKey);

          for (const record of records) {
            // Check for ID conflict on related record
            const relatedId = record.id as number | undefined;
            if (relatedId != null) {
              const conflictCheck = await tx.$queryRawUnsafe<{ cnt: number }[]>(
                `SELECT COUNT(*)::int AS cnt FROM "${relatedTable}" WHERE id = $1`,
                relatedId
              );
              if (conflictCheck[0]?.cnt > 0) {
                // Skip this related record if ID conflicts
                continue;
              }
            }

            const [relSql, relParams] = buildInsertSql(
              relatedTable,
              record,
              relatedColumnMap
            );
            await tx.$executeRawUnsafe(relSql, ...relParams);
            tablesNeedingSequenceReset.add(relatedTable);
          }
        }
      }

      // 4. Reset sequences for all related tables that had inserts
      for (const relatedTable of tablesNeedingSequenceReset) {
        await tx.$executeRawUnsafe(buildResetSequenceSql(relatedTable));
      }

      // 5. Update DeletionRequest status to restored
      await tx.deletionRequest.update({
        where: { id: requestId },
        data: {
          status: "restored",
          restoredAt: new Date(),
          restoredById: userId,
        },
      });
    });

    // Audit log — failure must not affect primary operation
    try {
      await createAuditLogEntry({
        entityType,
        entityId,
        action: "RESTORE",
        userId,
        userEmail,
        oldData: null,
        newData: snapshot.entity as Record<string, unknown>,
        changedFields: [],
      });
    } catch {
      // Audit failure must not affect CRUD result
    }

    revalidatePath("/clients");
    revalidatePath("/cases");
    revalidatePath("/contacts");
    revalidatePath("/admin/deletion-requests");

    return { success: true, data: null };
  } catch {
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}
