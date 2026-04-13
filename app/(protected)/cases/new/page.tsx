"use client";

import { useSearchParams } from "next/navigation";
import { createCase } from "@/app/_lib/actions/case-actions";
import CaseForm from "../_components/case-form";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";

export default function NewCasePage() {
  const searchParams = useSearchParams();
  const clientIdParam = searchParams.get("clientId");
  const clientId = clientIdParam ? Number(clientIdParam) : undefined;

  return (
    <PageContainer size="narrow">
      <BreadcrumbNav items={[{ label: "案件", href: "/cases" }, { label: "新增" }]} />
      <PageHeader title="新增案件" />
      <CaseForm
        onSubmitAction={createCase}
        submitLabel="新增"
        clientId={clientId}
      />
    </PageContainer>
  );
}
