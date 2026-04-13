import { notFound } from "next/navigation";
import { prisma } from "@/app/_lib/db";
import EditCaseForm from "./edit-case-form";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCasePage({ params }: Props) {
  const { id } = await params;
  const caseId = Number(id);
  if (Number.isNaN(caseId)) notFound();

  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    include: { staffInCharge: { select: { id: true } } },
  });
  if (!caseRecord) notFound();

  const defaultValues = {
    ...caseRecord,
    staffInChargeIds: caseRecord.staffInCharge.map((s) => s.id),
  };

  return (
    <PageContainer size="narrow">
      <BreadcrumbNav
        items={[
          { label: "案件", href: "/cases" },
          { label: caseRecord.name ?? "(未命名)", href: `/cases/${id}` },
          { label: "編輯" },
        ]}
      />
      <PageHeader title={`編輯案件 — ${caseRecord.name ?? "(未命名)"}`} />
      <EditCaseForm caseId={caseId} defaultValues={defaultValues} />
    </PageContainer>
  );
}
