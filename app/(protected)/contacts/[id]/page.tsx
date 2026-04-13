import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/app/_lib/db";
import { CONTACT_TYPE_LABELS } from "@/app/_lib/constants/enums";
import HistoryViewer from "@/app/_components/history-viewer";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({ params }: Props) {
  const { id } = await params;
  const contactId = Number(id);
  if (Number.isNaN(contactId)) notFound();

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      client: { select: { id: true, name: true } },
      staffInCharge: { select: { id: true, name: true } },
    },
  });

  if (!contact) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">通聯詳情</h1>
        <Link
          href="/contacts"
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
        >
          返回列表
        </Link>
      </div>

      {/* Associated client */}
      <div className="mb-6 rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold mb-2">關聯族人</h2>
        <Link
          href={`/clients/${contact.client.id}`}
          className="text-indigo-600 hover:underline"
        >
          {contact.client.name ?? "(未命名)"} (ID: {contact.client.id})
        </Link>
      </div>

      {/* Contact details */}
      <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3 text-sm">
        <h2 className="text-lg font-semibold mb-2">通聯資料</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          <InfoRow
            label="日期"
            value={
              contact.date
                ? new Date(contact.date).toLocaleDateString("zh-TW")
                : null
            }
          />
          <InfoRow
            label="類型"
            value={
              contact.contactType
                ? (CONTACT_TYPE_LABELS[contact.contactType] ?? contact.contactType)
                : null
            }
          />
          <InfoRow label="成功" value={contact.isSuccess ? "是" : "否"} />
          <InfoRow
            label="承辦人"
            value={
              contact.staffInCharge.map((s) => s.name).join(", ") || null
            }
          />
        </div>

        {contact.record && (
          <>
            <hr className="my-3" />
            <h3 className="text-base font-semibold mb-2">紀錄</h3>
            <p className="text-gray-700 whitespace-pre-wrap">
              {contact.record}
            </p>
          </>
        )}
      </div>

      <HistoryViewer entityType="Contact" entityId={contact.id} />
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
