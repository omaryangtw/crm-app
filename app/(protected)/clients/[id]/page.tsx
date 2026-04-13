import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/app/_lib/db";
import { computeBirthdayFields } from "@/app/_lib/utils/date-utils";
import {
  SEX_LABELS,
  INCOME_STATUS_LABELS,
  DISABLED_STATUS_LABELS,
  INDIGENOUS_GROUP_LABELS,
  PLAIN_MOUNTAIN_LABELS,
  CASE_STATUS_LABELS,
  CASE_TYPE_MAJOR_LABELS,
  CONTACT_TYPE_LABELS,
} from "@/app/_lib/constants/enums";
import { DeleteClientButton } from "./delete-client-button";
import { FamilySection } from "./_components/family-section";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const clientId = Number(id);
  if (Number.isNaN(clientId)) notFound();

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      cases: {
        include: { staffInCharge: { select: { id: true, name: true } } },
      },
      contacts: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        include: { staffInCharge: { select: { id: true, name: true } } },
      },
      familyRelationsAsA: { include: { personB: true } },
      familyRelationsAsB: { include: { personA: true } },
    },
  });

  if (!client) notFound();

  const birthday = computeBirthdayFields(client.birthday);

  // Merge family relations from both directions
  const familyMembers = [
    ...client.familyRelationsAsA.map((r) => ({
      id: r.id,
      personId: r.personB.id,
      personName: r.personB.name ?? "(未命名)",
      relationship: r.relationAToB,
    })),
    ...client.familyRelationsAsB.map((r) => ({
      id: r.id,
      personId: r.personA.id,
      personName: r.personA.name ?? "(未命名)",
      relationship: r.relationBToA,
    })),
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header with action buttons */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">
          族人詳情 — {client.name ?? "(未命名)"}
        </h1>
        <div className="flex gap-3">
          <Link
            href={`/clients/${client.id}/edit`}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            編輯
          </Link>
          <DeleteClientButton clientId={client.id} clientName={client.name} />
        </div>
      </div>

      {/* Two-column layout: left = photo + basic info, right = contact info + note */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {/* Left column */}
        <div className="md:col-span-1 space-y-4">
          {/* Photo placeholder */}
          <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center min-h-[200px]">
            <div className="text-center text-gray-400">
              <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
              </svg>
              <p className="mt-1 text-sm">照片</p>
            </div>
          </div>

          {/* Basic info */}
          <div className="bg-white rounded-lg shadow p-4 space-y-3 text-sm">
            <InfoRow label="姓名" value={client.name} />
            {client.nameAlt && <InfoRow label="別名" value={client.nameAlt} />}
            <InfoRow label="性別" value={client.sex ? SEX_LABELS[client.sex] : null} />
            <InfoRow
              label="生日"
              value={client.birthday ? format(client.birthday, "yyyy-MM-dd") : null}
            />
            {birthday.age !== null && (
              <InfoRow label="年齡" value={`${birthday.age} 歲`} />
            )}
            <InfoRow label="身分證號" value={client.idn} />
            <InfoRow
              label="族別"
              value={client.indigenousGroup ? INDIGENOUS_GROUP_LABELS[client.indigenousGroup] : null}
            />
            <InfoRow label="部落" value={client.tribe} />
            <InfoRow
              label="平原/山原"
              value={client.plainMountain ? PLAIN_MOUNTAIN_LABELS[client.plainMountain] : null}
            />
            <InfoRow
              label="收入狀況"
              value={client.incomeStatus ? INCOME_STATUS_LABELS[client.incomeStatus] : null}
            />
            <InfoRow
              label="身心障礙"
              value={client.disabledStatus ? DISABLED_STATUS_LABELS[client.disabledStatus] : null}
            />
            <InfoRow label="死亡" value={client.isDead ? "是" : "否"} highlight={client.isDead} />
            <InfoRow label="戶長" value={client.householdAdmin ? "是" : "否"} />
          </div>
        </div>

        {/* Right column */}
        <div className="md:col-span-3 space-y-4">
          <div className="bg-white rounded-lg shadow p-4 space-y-3 text-sm">
            <h2 className="text-lg font-semibold mb-2">聯絡資訊</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <InfoRow label="電話可否" value={client.canCall ? "可" : "不可"} />
              <InfoRow label="郵寄可否" value={client.canMail ? "可" : "不可"} />
              <InfoRow label="手機" value={client.mobile} />
              <InfoRow label="手機備註" value={client.mobileNote} />
              <InfoRow label="手機2" value={client.mobileAlt} />
              <InfoRow label="手機2備註" value={client.mobileAltNote} />
              <InfoRow label="電話" value={client.phone} />
              <InfoRow label="電話備註" value={client.phoneNote} />
              <InfoRow label="電話2" value={client.phoneAlt} />
              <InfoRow label="電話2備註" value={client.phoneAltNote} />
            </div>

            <hr className="my-3" />
            <h3 className="text-base font-semibold mb-2">地址</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <InfoRow label="城市" value={client.city} />
              <InfoRow label="區域" value={client.dist} />
              <InfoRow label="里" value={client.vill} />
              <InfoRow label="地址" value={client.addr} />
              <InfoRow label="地址備註" value={client.addrNote} />
            </div>
            {(client.cityAlt || client.distAlt || client.villAlt || client.addrAlt) && (
              <>
                <hr className="my-3" />
                <h3 className="text-base font-semibold mb-2">第二地址</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                  <InfoRow label="城市" value={client.cityAlt} />
                  <InfoRow label="區域" value={client.distAlt} />
                  <InfoRow label="里" value={client.villAlt} />
                  <InfoRow label="地址" value={client.addrAlt} />
                  <InfoRow label="地址備註" value={client.addrAltNote} />
                </div>
              </>
            )}

            {client.note && (
              <>
                <hr className="my-3" />
                <h3 className="text-base font-semibold mb-2">備註</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{client.note}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cases section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">案件紀錄 ({client.cases.length})</h2>
        {client.cases.length === 0 ? (
          <p className="text-gray-500 text-sm">尚無案件紀錄</p>
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">案件名稱</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">狀態</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">類型</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">承辦人</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {client.cases.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2">{c.name ?? "-"}</td>
                    <td className="px-4 py-2">
                      {c.status ? CASE_STATUS_LABELS[c.status] : "-"}
                    </td>
                    <td className="px-4 py-2">
                      {c.typesMajor ? CASE_TYPE_MAJOR_LABELS[c.typesMajor] : "-"}
                    </td>
                    <td className="px-4 py-2">{c.staffInCharge.map((s) => s.name).join(", ") || "-"}</td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/cases/${c.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        查看
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Contacts section */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">通聯紀錄 ({client.contacts.length})</h2>
          <Link
            href={`/contacts/new?clientId=${client.id}`}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            新增通聯
          </Link>
        </div>
        {client.contacts.length === 0 ? (
          <p className="text-gray-500 text-sm">尚無通聯紀錄</p>
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">日期</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">類型</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">成功</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">紀錄</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">承辦人</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {client.contacts.map((ct) => (
                  <tr key={ct.id}>
                    <td className="px-4 py-2">
                      {ct.date ? format(ct.date, "yyyy-MM-dd") : "-"}
                    </td>
                    <td className="px-4 py-2">
                      {ct.contactType ? CONTACT_TYPE_LABELS[ct.contactType] : "-"}
                    </td>
                    <td className="px-4 py-2">{ct.isSuccess ? "是" : "否"}</td>
                    <td className="px-4 py-2 max-w-xs truncate">{ct.record ?? "-"}</td>
                    <td className="px-4 py-2">{ct.staffInCharge.map((s) => s.name).join(", ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Family relations section — interactive client component */}
      <FamilySection clientId={client.id} familyMembers={familyMembers} />
    </div>
  );
}

/** Simple read-only info row component */
function InfoRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="font-semibold text-gray-600">{label}</span>
      <span className={highlight ? "text-red-600 font-bold" : "text-gray-800"}>
        {value ?? "-"}
      </span>
    </div>
  );
}
