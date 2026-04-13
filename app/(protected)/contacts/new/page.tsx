"use client";

import { useSearchParams } from "next/navigation";
import { createContact } from "@/app/_lib/actions/contact-actions";
import ContactForm from "../_components/contact-form";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";

export default function NewContactPage() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("clientId");

  return (
    <PageContainer size="narrow">
      <BreadcrumbNav items={[{ label: "通聯紀錄", href: "/contacts" }, { label: "新增" }]} />
      <PageHeader title="新增通聯紀錄" />
      <ContactForm
        onSubmitAction={createContact}
        submitLabel="新增"
        clientId={clientId ? Number(clientId) : undefined}
      />
    </PageContainer>
  );
}
