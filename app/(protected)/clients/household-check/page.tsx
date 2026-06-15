import { prisma } from "@/app/_lib/db";
import Link from "next/link";

export interface HouseholdFlaggedClient {
  id: number;
  name: string | null;
  addr: string;
}

export default async function HouseholdCheckPage() {
  // Get all clients with addr and canMail=true
  const clients = await prisma.client.findMany({
    where: {
      id: { not: 0 },
      addr: { not: null },
      canMail: true,
    },
    select: {
      id: true,
      name: true,
      addr: true,
      householdAdmin: true,
    },
  });

  // Group by addr, filter groups with zero householdAdmin
  const grouped = new Map<string, typeof clients>();
  for (const c of clients) {
    const addr = c.addr!;
    if (!grouped.has(addr)) grouped.set(addr, []);
    grouped.get(addr)!.push(c);
  }

  const flagged: HouseholdFlaggedClient[] = [];
  for (const [addr, group] of grouped) {
    const hasAdmin = group.some((c) => c.householdAdmin);
    if (!hasAdmin) {
      for (const c of group) {
        flagged.push({ id: c.id, name: c.name, addr });
      }
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-4">戶長檢查</h1>

      <div className="mb-6 rounded-lg border border-border bg-muted/40 p-4 text-sm text-foreground">
        <p className="mb-2 font-medium">這個頁面在做什麼？</p>
        <p className="mb-3 text-muted-foreground">
          系統會找出「同一個地址、啟用郵寄，但沒有任何一位族人被設為戶長」的情況。
          寄送紙本郵件時，每個地址需要一位戶長作為收件代表；若整個地址都沒有戶長，
          郵件可能無法正確寄達，或對同住的多位族人重複寄送。
        </p>
        <p className="mb-2 font-medium">發現未設戶長時，怎麼處理？</p>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>點下方清單中的族人姓名，進入該族人的詳情頁。</li>
          <li>編輯該族人資料，將同住址中應作為收件代表的人勾選為「戶長」。</li>
          <li>每個地址只需設定一位戶長即可，設定後該地址就會從本清單消失。</li>
        </ol>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        以下地址啟用郵寄但未設定戶長，共 {flagged.length} 筆
      </p>
      {flagged.length === 0 ? (
        <p className="text-muted-foreground">所有地址皆已設定戶長。</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border bg-card text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-foreground">
                  姓名
                </th>
                <th className="px-4 py-3 text-left font-medium text-foreground">
                  地址
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {flagged.map((c) => (
                <tr key={c.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/clients/${c.id}`}
                      className="text-primary hover:underline"
                    >
                      {c.name ?? "(未命名)"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-foreground">{c.addr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
