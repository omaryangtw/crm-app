import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/app/_lib/db";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { ClientTable } from "./client-table";

const DEFAULT_PAGE_SIZE = 25;

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
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
}

export default async function ClientsPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q;
  const pageSize = Math.max(1, parseInt(params.pageSize ?? "", 10) || DEFAULT_PAGE_SIZE);

  const where = q
    ? {
        OR: SEARCH_FIELDS.map((field) => ({
          [field]: { contains: q, mode: "insensitive" as const },
        })),
      }
    : undefined;

  const total = await prisma.client.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(parseInt(params.page ?? "", 10) || 1, totalPages));
  const skip = (page - 1) * pageSize;

  const clients = await prisma.client.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: { updatedAt: "desc" },
  });

  return (
    <PageContainer>
      <PageHeader
        title="族人列表"
        actions={
          <Link href="/clients/new">
            <Button>
              <Plus className="size-4" data-icon="inline-start" />
              新增族人
            </Button>
          </Link>
        }
      />
      <ClientTable
        clients={clients}
        searchQuery={q}
        pagination={{ page, pageSize, total }}
      />
    </PageContainer>
  );
}
