import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/app/_lib/db";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { CaseTable } from "./case-table";

const DEFAULT_PAGE_SIZE = 25;

const SEARCH_FIELDS = ["name", "note", "handle"] as const;

interface Props {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
}

export default async function CasesPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q;
  const pageSize = Math.max(1, parseInt(params.pageSize ?? "", 10) || DEFAULT_PAGE_SIZE);

  const where = q
    ? {
        OR: [
          ...SEARCH_FIELDS.map((field) => ({
            [field]: { contains: q, mode: "insensitive" as const },
          })),
          { client: { name: { contains: q, mode: "insensitive" as const } } },
          { staffInCharge: { some: { name: { contains: q, mode: "insensitive" as const } } } },
        ],
      }
    : undefined;

  const total = await prisma.case.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(parseInt(params.page ?? "", 10) || 1, totalPages));
  const skip = (page - 1) * pageSize;

  const cases = await prisma.case.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: { updatedAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      staffInCharge: { select: { id: true, name: true } },
    },
  });

  return (
    <PageContainer>
      <PageHeader
        title="案件列表"
        actions={
          <Link href="/cases/new">
            <Button>
              <Plus className="size-4" data-icon="inline-start" />
              新增案件
            </Button>
          </Link>
        }
      />
      <CaseTable
        cases={cases}
        searchQuery={q}
        pagination={{ page, pageSize, total }}
      />
    </PageContainer>
  );
}
