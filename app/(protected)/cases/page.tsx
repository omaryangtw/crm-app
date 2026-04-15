import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/app/_lib/db";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { parseFilters, buildFilterWhere } from "@/app/_lib/filters";
import { caseFilterConfig } from "@/app/_lib/filters/configs";
import { resolveRelationLabels } from "@/app/_lib/filters/relation-loaders";
import { CaseTable } from "./case-table";

const DEFAULT_PAGE_SIZE = 25;

const SEARCH_FIELDS = ["name", "note", "handle"] as const;

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function CasesPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q;
  const pageSize = Math.max(1, parseInt(params.pageSize ?? "", 10) || DEFAULT_PAGE_SIZE);

  const searchWhere = q
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

  const activeFilters = parseFilters(params, caseFilterConfig);
  const filterWhere = buildFilterWhere(activeFilters, caseFilterConfig);
  const relationLabels = await resolveRelationLabels(activeFilters, caseFilterConfig);
  const andClauses = [searchWhere, filterWhere].filter(
    (w) => w && Object.keys(w).length > 0,
  );
  const where = andClauses.length > 0 ? { AND: andClauses } : undefined;

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
        filterConfig={caseFilterConfig}
        activeFilters={activeFilters}
        relationLabels={relationLabels}
      />
    </PageContainer>
  );
}
