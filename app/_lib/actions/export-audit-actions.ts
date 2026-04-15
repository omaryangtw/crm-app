"use server";

import { prisma } from "../db";
import { auth } from "../auth";

export interface ExportAuditEntry {
  id: number;
  userEmail: string;
  createdAt: string;
  exportType: string;
  resultCount: number;
  filters: Record<string, unknown> | null;
  columns: string[] | null;
}

/**
 * Fetch the most recent export audit log entries.
 * Admin-only.
 */
export async function getExportAuditLogs(
  limit = 20,
): Promise<ExportAuditEntry[]> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return [];

  const entries = await prisma.auditLog.findMany({
    where: { entityType: "Export", action: "EXPORT" },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return entries.map((e) => {
    const newData = (e.newData as Record<string, unknown>) ?? {};
    return {
      id: e.id,
      userEmail: e.userEmail,
      createdAt: e.createdAt.toISOString(),
      exportType: (newData.type as string) ?? "unknown",
      resultCount: (newData.resultCount as number) ?? 0,
      filters: (newData.filters as Record<string, unknown>) ?? null,
      columns: (newData.columns as string[]) ?? null,
    };
  });
}
