import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/app/_lib/db";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { parseFilters, buildFilterWhere } from "@/app/_lib/filters";
import { contactFilterConfig } from "@/app/_lib/filters/configs";
import { resolveRelationLabels } from "@/app/_lib/filters/relation-loaders";
import { ContactTable } from "./contact-table";

const DEFAULT_PAGE_SIZE = 25;

const SEARCH_FIELDS = ["record"] as const;

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ContactsPage({ searchParams }: Props) {
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
        ],
      }
    : undefined;

  const activeFilters = parseFilters(params, contactFilterConfig);
  const filterWhere = buildFilterWhere(activeFilters, contactFilterConfig);
  const relationLabels = await resolveRelationLabels(activeFilters, contactFilterConfig);
  const andClauses = [searchWhere, filterWhere].filter(
    (w): w is Record<string, unknown> => w != null && Object.keys(w).length > 0,
  );
  const where = andClauses.length > 0 ? { AND: andClauses } : undefined;

  const total = await prisma.contact.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(parseInt(params.page ?? "", 10) || 1, totalPages));
  const skip = (page - 1) * pageSize;

  const contacts = await prisma.contact.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: { date: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      staffInCharge: { select: { id: true, name: true } },
      case: { select: { id: true, name: true } },
    },
  });

  return (
    <PageContainer>
      <PageHeader
        title="通聯紀錄"
        actions={
          <Link href="/contacts/new">
            <Button>
              <Plus className="size-4" data-icon="inline-start" />
              新增通聯
            </Button>
          </Link>
        }
      />
      <ContactTable
        contacts={contacts}
        searchQuery={q}
        pagination={{ page, pageSize, total }}
        filterConfig={contactFilterConfig}
        activeFilters={activeFilters}
        relationLabels={relationLabels}
      />
    </PageContainer>
  );
}
