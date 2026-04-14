"use server";

import { auth } from "@/app/_lib/auth";
import { prisma } from "@/app/_lib/db";

export interface GlobalSearchResult {
  clients: { id: number; name: string | null; idn: string | null }[];
  cases: {
    id: number;
    name: string | null;
    clientName: string | null;
    status: string | null;
  }[];
  contacts: {
    id: number;
    record: string | null;
    clientName: string | null;
    date: Date | null;
  }[];
}

export async function globalSearch(
  query: string
): Promise<GlobalSearchResult> {
  const session = await auth();
  if (!session?.user) {
    return { clients: [], cases: [], contacts: [] };
  }

  if (query.length < 2) {
    return { clients: [], cases: [], contacts: [] };
  }

  const [clients, cases, contacts] = await Promise.all([
    prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { idn: { contains: query, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, idn: true },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.case.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { client: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        name: true,
        status: true,
        client: { select: { name: true } },
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.contact.findMany({
      where: {
        OR: [
          { record: { contains: query, mode: "insensitive" } },
          { client: { name: { contains: query, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        record: true,
        date: true,
        client: { select: { name: true } },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    clients,
    cases: cases.map((c) => ({
      id: c.id,
      name: c.name,
      clientName: c.client.name,
      status: c.status,
    })),
    contacts: contacts.map((ct) => ({
      id: ct.id,
      record: ct.record,
      clientName: ct.client.name,
      date: ct.date,
    })),
  };
}
