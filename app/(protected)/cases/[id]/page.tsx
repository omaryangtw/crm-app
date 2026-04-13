import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/app/_lib/db";
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_MAJOR_LABELS,
  CASE_TYPE_MINOR_LABELS,
} from "@/app/_lib/constants/enums";
import { DeleteCaseButton } from "./delete-case-button";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CaseDetailPage({ params }: Props) {
  const { id } = await params;
  const caseId = Number(id);
  if (Number.isNaN(caseId)) notFound();

  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    include: { client: true, staffInCharge: { select: { id: true, name: true } } },
  });

  if (!caseRecord) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">
          案件詳情 — {caseRecord.name ?? "(未命名)"}
        </h1>
        <div className="flex gap-3">
          <Link
            href={`/cases/${caseRecord.id}/edit`}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            編輯
          </Link>
          <DeleteCaseButton caseId={caseRecord.id} caseName={caseRecord.name} />
        </div>
      </div>

      {/* Associated client */}
      <div className="mb-6 rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold mb-2">關聯族人</h2>
        <Link
          href={`/clients/${caseRecord.client.id}`}
          className="text-indigo-600 hover:underline"
        >
          {caseRecord.client.name ?? "(未命名)"} (ID: {caseRecord.client.id})
        </Link>
      </div>

      {/* Case details */}
      <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3 text-sm">
        <h2 className="text-lg font-semibold mb-2">案件資料</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          <InfoRow label="案件名稱" value={caseRecord.name} />
          <InfoRow label="狀態" value={caseRecord.status ? CASE_STATUS_LABELS[caseRecord.status] : null} />
          <InfoRow label="承辦人" value={caseRecord.staffInCharge.map((s) => s.name).join(", ") || null} />
          <InfoRow label="案件大類" value={caseRecord.typesMajor ? CASE_TYPE_MAJOR_LABELS[caseRecord.typesMajor] : null} />
          <InfoRow label="案件小類" value={caseRecord.typesMinor ? CASE_TYPE_MINOR_LABELS[caseRecord.typesMinor] : null} />
        </div>

        <hr className="my-3" />
        <h3 className="text-base font-semibold mb-2">關係人</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2">
          <InfoRow label="關係人 1" value={caseRecord.relation1} />
          <InfoRow label="關係人 2" value={caseRecord.relation2} />
          <InfoRow label="關係人 3" value={caseRecord.relation3} />
        </div>

        <hr className="my-3" />
        <h3 className="text-base font-semibold mb-2">聯絡人</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2">
          <InfoRow label="聯絡人 1" value={caseRecord.contact1} />
          <InfoRow label="聯絡人 2" value={caseRecord.contact2} />
          <InfoRow label="聯絡人 3" value={caseRecord.contact3} />
        </div>

        {caseRecord.note && (
          <>
            <hr className="my-3" />
            <h3 className="text-base font-semibold mb-2">備註</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{caseRecord.note}</p>
          </>
        )}

        {caseRecord.handle && (
          <>
            <hr className="my-3" />
            <h3 className="text-base font-semibold mb-2">處理情形</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{caseRecord.handle}</p>
          </>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex justify-between">
      <span className="font-semibold text-gray-600">{label}</span>
      <span className="text-gray-800">{value ?? "-"}</span>
    </div>
  );
}
