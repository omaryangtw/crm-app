/**
 * Audit service — pure utility functions and write operations for audit logs.
 *
 * computeChangedFields: compares top-level keys of two objects using
 *   JSON.stringify per-field equality.
 * serializeEntity: round-trips a Prisma record through JSON to strip
 *   metadata and convert Dates to ISO strings.
 * createAuditLogEntry: writes a single immutable audit log row.
 *
 * No update or delete functions are exposed — audit entries are append-only.
 */

import { prisma } from "../db";
import type { Prisma } from "@prisma/client";
import type { CreateAuditLogParams } from "./audit-types";

export function computeChangedFields(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>
): string[] {
  const SYSTEM_FIELDS = new Set(["id", "createdAt", "updatedAt"]);
  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  return [...allKeys]
    .filter((key) => !SYSTEM_FIELDS.has(key))
    .filter(
      (key) => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])
    );
}

export function serializeEntity(
  record: Record<string, unknown>
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(record));
}

export async function createAuditLogEntry(
  params: CreateAuditLogParams
): Promise<void> {
  try {
    // Use caller-provided changedFields if non-empty; otherwise compute from snapshots
    const changedFields =
      params.changedFields.length > 0
        ? params.changedFields
        : params.action === "UPDATE" &&
            params.oldData !== null &&
            params.newData !== null
          ? computeChangedFields(params.oldData, params.newData)
          : [];

    // Skip writing audit for UPDATE actions with no actual field changes
    if (params.action === "UPDATE" && changedFields.length === 0) return;

    await prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        userId: params.userId,
        userEmail: params.userEmail,
        oldData: (params.oldData ?? undefined) as Prisma.InputJsonValue | undefined,
        newData: (params.newData ?? undefined) as Prisma.InputJsonValue | undefined,
        changedFields,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log entry", {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      userId: params.userId,
      error,
    });
  }
}
