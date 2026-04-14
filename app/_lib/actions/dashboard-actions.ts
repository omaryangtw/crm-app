"use server";

import { prisma } from "@/app/_lib/db";
import { startOfMonth } from "date-fns";
import { extractEntityName } from "@/app/_lib/utils/search-utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PersonalStats {
  activeCases: number;
  monthlyContacts: number;
  staleClients: number;
}

export interface RecentActivityItem {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  entityName: string;
  /** For Contact entries: the related client name */
  clientName?: string | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// getPersonalStats
// ---------------------------------------------------------------------------

export async function getPersonalStats(
  staffId: number,
): Promise<PersonalStats> {
  const [activeCases, monthlyContacts, staleClients] = await Promise.all([
    prisma.case.count({
      where: {
        status: "in_progress",
        staffInCharge: { some: { id: staffId } },
      },
    }),
    prisma.contact.count({
      where: {
        date: { gte: startOfMonth(new Date()) },
        staffInCharge: { some: { id: staffId } },
      },
    }),
    prisma.client.count({
      where: {
        cases: {
          some: {
            status: "in_progress",
            staffInCharge: { some: { id: staffId } },
          },
        },
        contacts: {
          none: {
            date: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
            isSuccess: true,
          },
        },
      },
    }),
  ]);

  return { activeCases, monthlyContacts, staleClients };
}

// ---------------------------------------------------------------------------
// getRecentActivity
// ---------------------------------------------------------------------------

export async function getRecentActivity(
  userId: number,
): Promise<RecentActivityItem[]> {
  const entries = await prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      newData: true,
      oldData: true,
      createdAt: true,
    },
  });

  // Collect clientIds from Contact entries to batch-fetch client names
  const clientIdSet = new Set<number>();
  for (const entry of entries) {
    if (entry.entityType === "Contact") {
      const data = (entry.newData ?? entry.oldData) as Record<string, unknown> | null;
      const cid = data?.clientId as number | undefined;
      if (cid) clientIdSet.add(cid);
    }
  }

  const clientNameMap = new Map<number, string>();
  if (clientIdSet.size > 0) {
    const clients = await prisma.client.findMany({
      where: { id: { in: [...clientIdSet] } },
      select: { id: true, name: true },
    });
    for (const c of clients) {
      clientNameMap.set(c.id, c.name ?? "(未命名)");
    }
  }

  return entries.map((entry) => {
    const data = (entry.newData ?? entry.oldData) as Record<
      string,
      unknown
    > | null;
    const clientId = data?.clientId as number | undefined;
    return {
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      entityName: extractEntityName(entry.entityType, data),
      clientName: entry.entityType === "Contact" && clientId
        ? clientNameMap.get(clientId) ?? null
        : null,
      createdAt: entry.createdAt,
    };
  });
}
