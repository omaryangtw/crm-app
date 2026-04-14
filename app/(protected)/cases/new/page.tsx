import { auth } from "@/app/_lib/auth";
import { createCase } from "@/app/_lib/actions/case-actions";
import CaseForm from "../_components/case-form";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";

interface Props {
  searchParams: Promise<{ clientId?: string }>;
}

export default async function NewCasePage({ searchParams }: Props) {
  const params = await searchParams;
  const session = await auth();
  const sessionStaffId = session?.user?.staffId ?? null;
  const clientId = params.clientId ? Number(params.clientId) : undefined;

  return (
    <PageContainer size="narrow">
      <BreadcrumbNav items={[{ label: "案件", href: "/cases" }, { label: "新增" }]} />
      <PageHeader title="新增案件" />
      <CaseForm
        onSubmitAction={createCase}
        submitLabel="新增"
        clientId={clientId}
        sessionStaffId={sessionStaffId}
        enableDraft
      />
    </PageContainer>
  );
}
