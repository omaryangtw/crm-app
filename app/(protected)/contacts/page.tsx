import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/app/_lib/db";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { ContactTable } from "./contact-table";

const DEFAULT_PAGE_SIZE = 25;

const SEARCH_FIELDS = ["record"] as const;

interface Props {
  searchParams: Promise<{ q?: string; page?: string; pageSize?: string }>;
}

export default async function ContactsPage({ searchParams }: Props) {
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
        ],
      }
    : undefined;

  const total = await prisma.contact.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(parseInt(params.page ?? "", 10) || 1, totalPages));
  const skip = (page - 1) * pageSize;

  const contacts = await prisma.contact.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: { createdAt: "desc" },
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
      />
    </PageContainer>
  );
}
