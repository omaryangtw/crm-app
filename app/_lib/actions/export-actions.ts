"use server";

import { prisma } from "../db";
import { auth } from "../auth";
import { buildExportWhereClause } from "../utils/export-utils";
import { exportCriteriaSchema } from "../schemas/export-schema";
import { createAuditLogEntry } from "../audit/audit-service";
import type { ExportCriteria } from "../schemas/export-schema";
import type { ActionResult } from "./auth-actions";

/**
 * Export clients based on filter criteria.
 * Admin-only — returns "權限不足" for unauthorized users.
 */
export async function exportClients(
  criteria: ExportCriteria
): Promise<ActionResult<Record<string, unknown>[]>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "權限不足" };
  }

  const parsed = exportCriteriaSchema.safeParse(criteria);
  if (!parsed.success) {
    return { success: false, error: "匯出條件格式錯誤" };
  }

  const { query, attributes, flag } = parsed.data;

  // Google Contacts preset
  if (flag === "contacts") {
    return exportGoogleContacts(session);
  }

  const where = buildExportWhereClause(query);

  // Build select from attributes (only true values)
  const selectedColumns = Object.entries(attributes)
    .filter(([, v]) => v === true)
    .map(([k]) => k);

  // Always include id for reference
  const select: Record<string, boolean> = { id: true };
  for (const col of selectedColumns) {
    select[col] = true;
  }

  try {
    const clients = await prisma.client.findMany({ where, select });

    const userId = parseInt(session.user.id ?? "0", 10);
    const userEmail = session.user.email ?? "";
    await createAuditLogEntry({
      entityType: "Export",
      entityId: 0,
      action: "EXPORT",
      userId,
      userEmail,
      oldData: null,
      newData: {
        type: "custom",
        filters: query,
        columns: selectedColumns,
        resultCount: clients.length,
      },
      changedFields: [],
    });

    return {
      success: true,
      data: clients as unknown as Record<string, unknown>[],
    };
  } catch {
    return { success: false, error: "匯出失敗，請稍後再試" };
  }
}

/**
 * Export all living clients with addresses in Google Contacts format.
 */
async function exportGoogleContacts(
  session: { user: { id?: string; email?: string | null } },
): Promise<
  ActionResult<Record<string, unknown>[]>
> {
  try {
    const clients = await prisma.client.findMany({
      where: {
        isDead: false,
        addr: { not: null },
      },
      include: {
        contacts: {
          select: { record: true, date: true },
          orderBy: { date: "asc" },
        },
      },
    });

    const data = clients.map((client) => {
      const notes = client.contacts
        .map((c) => c.record ?? "")
        .filter((r) => r.length > 0)
        .join("\n");

      const homeAddress = [
        client.city ?? "",
        client.dist ?? "",
        client.vill ?? "",
        client.addr ?? "",
      ].join("");

      return {
        "First Name": client.name ?? "",
        "Middle Name": client.nameAlt ?? "",
        Birthday: client.birthday
          ? client.birthday.toISOString().split("T")[0]
          : "",
        "Mobile Phone": client.mobile ?? "",
        "Other Phone": client.mobileAlt ?? "",
        "Business Phone": client.phone ?? "",
        "Business Phone 2": client.phoneAlt ?? "",
        "Home Address": homeAddress,
        Notes: notes,
      };
    });

    const userId = parseInt(session.user.id ?? "0", 10);
    const userEmail = session.user.email ?? "";
    await createAuditLogEntry({
      entityType: "Export",
      entityId: 0,
      action: "EXPORT",
      userId,
      userEmail,
      oldData: null,
      newData: { type: "googleContacts", resultCount: data.length },
      changedFields: [],
    });

    return {
      success: true,
      data: data as unknown as Record<string, unknown>[],
    };
  } catch {
    return { success: false, error: "匯出失敗，請稍後再試" };
  }
}
