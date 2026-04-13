import { prisma } from "@/app/_lib/db";
import { startOfDay } from "date-fns";
import { CaseTable } from "./case-table";

const SEARCH_FIELDS = ["name", "note", "handle"] as const;

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function CasesPage({ searchParams }: Props) {
  const { q } = await searchParams;

  const todayStart = startOfDay(new Date());

  const [cases, totalCount, dailyCount] = await Promise.all([
    prisma.case.findMany({
      where: q
        ? {
            OR: SEARCH_FIELDS.map((field) => ({
              [field]: { contains: q, mode: "insensitive" as const },
            })),
          }
        : undefined,
      take: q ? undefined : 100,
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { id: true, name: true } },
        staffInCharge: { select: { id: true, name: true } },
      },
    }),
    prisma.case.count(),
    prisma.case.count({
      where: { createdAt: { gte: todayStart } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-4">案件列表</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">今日新增</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {dailyCount}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">案件總數</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {totalCount}
          </p>
        </div>
      </div>

      <CaseTable cases={cases} />
    </div>
  );
}
