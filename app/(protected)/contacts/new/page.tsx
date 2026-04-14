import { auth } from "@/app/_lib/auth";
import { createContact } from "@/app/_lib/actions/contact-actions";
import ContactForm from "../_components/contact-form";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";

interface Props {
  searchParams: Promise<{ clientId?: string; caseId?: string }>;
}

export default async function NewContactPage({ searchParams }: Props) {
  const params = await searchParams;
  const session = await auth();
  const sessionStaffId = session?.user?.staffId ?? null;
  const clientId = params.clientId ? Number(params.clientId) : undefined;
  const caseId = params.caseId ? Number(params.caseId) : undefined;

  return (
    <PageContainer size="narrow">
      <BreadcrumbNav items={[{ label: "通聯紀錄", href: "/contacts" }, { label: "新增" }]} />
      <PageHeader title="新增通聯紀錄" />
      <ContactForm
        onSubmitAction={createContact}
        submitLabel="新增"
        clientId={clientId}
        caseId={caseId}
        sessionStaffId={sessionStaffId}
      />
    </PageContainer>
  );
}
