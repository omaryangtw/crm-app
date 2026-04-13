import { prisma } from "../db";
import type { EntityType } from "./audit-types";

interface GetAuditLogsParams {
  entityType: EntityType;
  entityId: number;
  cursor?: number;
  pageSize?: number;
}

export async function getAuditLogs({
  entityType,
  entityId,
  cursor,
  pageSize = 20,
}: GetAuditLogsParams) {
  const entries = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: pageSize + 1,
    ...(cursor != null && {
      cursor: { id: cursor },
      skip: 1,
    }),
  });

  const hasMore = entries.length > pageSize;
  if (hasMore) entries.pop();

  const nextCursor = hasMore ? entries[entries.length - 1].id : null;

  return { entries, nextCursor };
}
