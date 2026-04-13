import Link from "next/link";
import { prisma } from "@/app/_lib/db";
import { CONTACT_TYPE_LABELS } from "@/app/_lib/constants/enums";

export default async function WeeklyContactsPage() {
  const contacts = await prisma.contact.findMany({
    take: 25,
    orderBy: { date: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      staffInCharge: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-4">近期通聯紀錄</h1>
      <p className="text-sm text-gray-500 mb-4">
        最近 25 筆通聯紀錄
      </p>

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">日期</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">族人</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">類型</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">成功</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">紀錄</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">承辦人</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  無資料
                </td>
              </tr>
            ) : (
              contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {contact.date
                      ? contact.date.toLocaleDateString("zh-TW")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/clients/${contact.client.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {contact.client.name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {contact.contactType
                      ? (CONTACT_TYPE_LABELS[contact.contactType] ?? contact.contactType)
                      : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {contact.isSuccess ? "✓" : "✗"}
                  </td>
                  <td className="px-4 py-3">
                    {contact.record
                      ? contact.record.length > 50
                        ? `${contact.record.slice(0, 50)}…`
                        : contact.record
                      : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {contact.staffInCharge.map((s) => s.name).join(", ") || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
