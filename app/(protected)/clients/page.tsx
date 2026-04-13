import { prisma } from "@/app/_lib/db";
import { ClientTable } from "./client-table";

const SEARCH_FIELDS = [
  "name",
  "mobile",
  "mobileAlt",
  "phone",
  "phoneAlt",
  "dist",
  "distAlt",
  "vill",
  "villAlt",
  "addr",
  "addrAlt",
  "addrNote",
  "addrAltNote",
  "note",
] as const;

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function ClientsPage({ searchParams }: Props) {
  const { q } = await searchParams;

  const clients = q
    ? await prisma.client.findMany({
        where: {
          OR: SEARCH_FIELDS.map((field) => ({
            [field]: { contains: q, mode: "insensitive" as const },
          })),
        },
      })
    : await prisma.client.findMany({
        take: 8,
        orderBy: { updatedAt: "desc" },
      });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-4">族人列表</h1>
      <ClientTable clients={clients} />
    </div>
  );
}
