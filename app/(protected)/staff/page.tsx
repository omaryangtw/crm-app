import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { getStaffList } from "@/app/_lib/actions/staff-actions";
import { auth } from "@/app/_lib/auth";
import { getAutoBindCandidates } from "@/app/_lib/actions/binding-actions";
import AutoBindBanner from "./_components/auto-bind-banner";
import { StaffTable } from "./staff-table";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function StaffPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  const params = await searchParams;
  const q = params.q;

  const staff = await getStaffList(q || undefined);

  const candidates = await getAutoBindCandidates();

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
      {candidates.length > 0 && (
        <AutoBindBanner candidateCount={candidates.length} />
      )}
      <StaffTable staff={staff} searchQuery={q} />
    </PageContainer>
  );
}
