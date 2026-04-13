import { notFound } from "next/navigation";
import { prisma } from "@/app/_lib/db";
import EditCaseForm from "./edit-case-form";

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
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-6">
        編輯案件 — {caseRecord.name ?? "(未命名)"}
      </h1>
      <EditCaseForm caseId={caseId} defaultValues={defaultValues} />
    </div>
  );
}
