import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { getStaffList } from "@/app/_lib/actions/staff-actions";
import { StaffTable } from "./staff-table";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function StaffPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q;

  const staff = await getStaffList(q || undefined);

  return (
    <PageContainer>
      <PageHeader
        title="員工管理"
        actions={
          <Link href="/staff/new">
            <Button>
              <Plus className="size-4" data-icon="inline-start" />
              新增員工
            </Button>
          </Link>
        }
      />
      <StaffTable staff={staff} searchQuery={q} />
    </PageContainer>
  );
}
