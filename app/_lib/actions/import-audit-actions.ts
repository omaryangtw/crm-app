"use server";

import { prisma } from "../db";
import { auth } from "../auth";

export interface ImportAuditEntry {
  id: number;
  userEmail: string;
  createdAt: string;
  table: string;
  fileName: string;
  conflictStrategy: string;
  inserted: number;
  overwritten: number;
  skipped: number;
  failed: number;
}

/**
 * Fetch the most recent import audit log entries.
 * Admin-only.
 */
export async function getImportAuditLogs(
  limit = 20,
): Promise<ImportAuditEntry[]> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return [];

  const entries = await prisma.auditLog.findMany({
    where: { entityType: "Import", action: "IMPORT" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return entries.map((e) => {
    const newData = (e.newData as Record<string, unknown>) ?? {};
    return {
      id: e.id,
      userEmail: e.userEmail,
      createdAt: e.createdAt.toISOString(),
      table: (newData.table as string) ?? "unknown",
      fileName: (newData.fileName as string) ?? "unknown",
      conflictStrategy: (newData.conflictStrategy as string) ?? "skip",
      inserted: (newData.inserted as number) ?? 0,
      overwritten: (newData.overwritten as number) ?? 0,
      skipped: (newData.skipped as number) ?? 0,
      failed: (newData.failed as number) ?? 0,
    };
  });
}
