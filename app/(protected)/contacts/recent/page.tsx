import Link from "next/link";
import { prisma } from "@/app/_lib/db";

export default async function RecentContactsPage() {
  // Fetch living, plain-mountain, callable clients who have at least one successful contact
  const clients = await prisma.client.findMany({
    where: {
      isDead: false,
      plainMountain: "plain",
      canCall: true,
      contacts: {
        some: { isSuccess: true },
      },
    },
    select: {
      id: true,
      name: true,
      birthday: true,
      contacts: {
        where: { isSuccess: true },
        select: { date: true },
      },
    },
  });

  // Compute max successful contact date per client, sort ASC (oldest first)
  const rows = clients
    .map((c) => {
      const successDates = c.contacts
        .map((ct) => ct.date)
        .filter((d): d is Date => d !== null);

      const maxDate =
        successDates.length > 0
          ? new Date(Math.max(...successDates.map((d) => d.getTime())))
          : null;

      return {
        id: c.id,
        name: c.name,
        birthday: c.birthday,
        lastSuccessDate: maxDate,
      };
    })
    .sort((a, b) => {
      if (!a.lastSuccessDate && !b.lastSuccessDate) return 0;
      if (!a.lastSuccessDate) return -1;
      if (!b.lastSuccessDate) return -1;
      return a.lastSuccessDate.getTime() - b.lastSuccessDate.getTime();
    });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-4">久未聯繫</h1>
      <p className="text-sm text-gray-500 mb-4">
        共 {rows.length} 位族人（平原、可聯繫、有成功通聯紀錄）
      </p>

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                姓名
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                生日
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">
                最近成功聯繫日期
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  無資料
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/clients/${row.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {row.name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.birthday
                      ? row.birthday.toLocaleDateString("zh-TW")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.lastSuccessDate
                      ? row.lastSuccessDate.toLocaleDateString("zh-TW")
                      : "—"}
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
