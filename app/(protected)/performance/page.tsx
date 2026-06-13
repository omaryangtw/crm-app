import { redirect } from "next/navigation";
import { prisma } from "@/app/_lib/db";
import { auth } from "@/app/_lib/auth";
import { Button } from "@/components/ui/button";

interface Props {
  searchParams: Promise<{ year?: string; month?: string }>;
}

export default async function PerformancePage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  const params = await searchParams;
  const now = new Date();
  const year = params.year ? parseInt(params.year, 10) : now.getFullYear();
  const month = params.month ? parseInt(params.month, 10) : now.getMonth() + 1;

  // Date range: first day of month to first day of next month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const contacts = await prisma.contact.findMany({
    where: {
      date: {
        gte: startDate,
        lt: endDate,
      },
    },
    select: {
      staffInCharge: { select: { name: true } },
      isSuccess: true,
    },
  });

  // Aggregate per staff member (a contact can have multiple staff)
  const aggregation = new Map<string, { total: number; successful: number }>();
  let overallTotal = 0;
  let overallSuccessful = 0;

  for (const c of contacts) {
    overallTotal += 1;
    if (c.isSuccess) overallSuccessful += 1;

    const people = c.staffInCharge.length > 0
      ? c.staffInCharge.map((s) => s.name)
      : ["（未指定）"];

    for (const person of people) {
      if (!aggregation.has(person)) {
        aggregation.set(person, { total: 0, successful: 0 });
      }
      const entry = aggregation.get(person)!;
      entry.total += 1;
      if (c.isSuccess) {
        entry.successful += 1;
      }
    }
  }

  const rows = Array.from(aggregation.entries())
    .map(([person, stats]) => ({ person, ...stats }))
    .sort((a, b) => b.total - a.total);

  // Generate month options for navigation
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-4">績效統計</h1>

      <form className="flex items-center gap-3 mb-6">
        <label className="text-sm text-muted-foreground">
          年份
          <input
            type="number"
            name="year"
            defaultValue={year}
            className="ml-2 w-24 rounded-md border border-input px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm text-muted-foreground">
          月份
          <select
            name="month"
            defaultValue={month}
            className="ml-2 rounded-md border border-input px-2 py-1 text-sm"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m} 月
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" size="sm">
          查詢
        </Button>
      </form>

      <p className="text-sm text-muted-foreground mb-4">
        {year} 年 {month} 月：共 {overallTotal} 筆通聯，成功 {overallSuccessful} 筆
      </p>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">承辦人</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">總通聯數</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">成功通聯數</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                  無資料
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.person} className="hover:bg-muted/50">
                  <td className="px-4 py-3 whitespace-nowrap">{row.person}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.total}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.successful}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
