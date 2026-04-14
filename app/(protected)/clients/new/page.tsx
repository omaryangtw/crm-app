"use client";

import { createClient } from "@/app/_lib/actions/client-actions";
import ClientForm from "../_components/client-form";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";

export default function NewClientPage() {
  return (
    <PageContainer size="narrow">
      <BreadcrumbNav items={[{ label: "族人", href: "/clients" }, { label: "新增" }]} />
      <PageHeader title="新增族人" />
      <ClientForm
        onSubmitAction={createClient}
        submitLabel="新增"
        enableDraft
      />
    </PageContainer>
  );
}
