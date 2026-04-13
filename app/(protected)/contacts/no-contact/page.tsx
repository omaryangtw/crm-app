import Link from "next/link";
import { prisma } from "@/app/_lib/db";

export default async function NoContactPage() {
  // Fetch living, plain-mountain clients with zero successful contacts
  const clients = await prisma.client.findMany({
    where: {
      isDead: false,
      plainMountain: "plain",
      contacts: {
        none: { isSuccess: true },
      },
    },
    select: {
      id: true,
      name: true,
      birthday: true,
      createdAt: true,
      _count: {
        select: {
          contacts: { where: { isSuccess: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = clients.map((c) => ({
    id: c.id,
    name: c.name,
    birthday: c.birthday,
    successfulCount: c._count.contacts,
    createdAt: c.createdAt,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-4">從未成功聯繫</h1>
      <p className="text-sm text-gray-500 mb-4">
        共 {rows.length} 位族人（平原、存活、無成功通聯紀錄）
      </p>

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">姓名</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">生日</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">成功聯繫次數</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">建立日期</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
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
                    {row.birthday ? row.birthday.toLocaleDateString("zh-TW") : "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">0</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.createdAt.toLocaleDateString("zh-TW")}
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
