"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/app/_lib/actions/client-actions";
import ClientForm from "../_components/client-form";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";

export default function NewClientPage() {
  const searchParams = useSearchParams();
  const copyFrom = searchParams.get("copyFrom");
  const [prefill, setPrefill] = useState<Record<string, unknown> | undefined>(undefined);

  useEffect(() => {
    if (!copyFrom) return;
    fetch(`/api/clients/${copyFrom}/copyable-fields`)
      .then((r) => r.json())
      .then((data) => setPrefill(data))
      .catch(() => {});
  }, [copyFrom]);

  return (
    <PageContainer size="narrow">
      <BreadcrumbNav items={[{ label: "族人", href: "/clients" }, { label: "新增" }]} />
      <PageHeader title="新增族人" />
      <ClientForm
        defaultValues={prefill}
        onSubmitAction={createClient}
        submitLabel="新增"
        enableDraft
      />
    </PageContainer>
  );
}
