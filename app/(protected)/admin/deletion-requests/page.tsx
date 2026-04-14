import { redirect } from "next/navigation";
import { DeletionRequestStatus } from "@prisma/client";
import { auth } from "@/app/_lib/auth";
import { getDeletionRequests } from "@/app/_lib/actions/deletion-actions";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";
import { DeletionRequestTable } from "./_components/deletion-request-table";

const VALID_STATUSES: DeletionRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
  "restored",
];

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function DeletionRequestsPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  const params = await searchParams;
  const statusFilter =
    params.status && VALID_STATUSES.includes(params.status as DeletionRequestStatus)
      ? (params.status as DeletionRequestStatus)
      : undefined;

  const result = await getDeletionRequests({ status: statusFilter });
  const requests = result.success ? result.data!.requests : [];
  const total = result.success ? result.data!.total : 0;

  return (
    <PageContainer>
      <BreadcrumbNav
        items={[
          { label: "首頁", href: "/" },
          { label: "刪除審核" },
        ]}
      />

      <PageHeader title="刪除審核" />

      <DeletionRequestTable
        requests={requests}
        total={total}
        currentStatus={statusFilter}
      />
    </PageContainer>
  );
}
