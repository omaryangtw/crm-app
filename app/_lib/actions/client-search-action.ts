"use server";

import { prisma } from "@/app/_lib/db";

export async function searchClientsByName(query: string) {
  if (!query || query.length < 2) return [];
  const clients = await prisma.client.findMany({
    where: { name: { contains: query, mode: "insensitive" } },
    select: { id: true, name: true },
    take: 10,
  });
  return clients;
}

export async function getClientNameById(id: number): Promise<string | null> {
  const client = await prisma.client.findUnique({
    where: { id },
    select: { name: true },
  });
  return client?.name ?? null;
}
