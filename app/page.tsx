import { prisma } from "@/app/_lib/db";
import { format, startOfMonth } from "date-fns";
import { Users, FileText, Phone, AlertTriangle } from "lucide-react";
import { auth } from "@/app/_lib/auth";
import { getPersonalStats, getRecentActivity } from "@/app/_lib/actions/dashboard-actions";
import { TodoDashboard } from "./_components/todo-dashboard";
import { PageContainer } from "./_components/page-container";
import { PageHeader } from "./_components/page-header";
import StatCard from "./_components/stat-card";
import { PersonalStats } from "./_components/personal-stats";
import { RecentActivity } from "./_components/recent-activity";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  const sessionStaffId = session?.user?.staffId ?? null;
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : null;

  const startOfCurrentMonth = startOfMonth(new Date());

  const [todos, clientCount, activeCaseCount, monthlyContactCount, staleCount] =
    await Promise.all([
      prisma.todo.findMany({
        where: { done: false },
        orderBy: { date: "asc" },
        include: {
          client: { select: { id: true, name: true } },
          staffInCharge: { select: { id: true, name: true } },
        },
      }),
      prisma.client.count(),
      prisma.case.count({ where: { status: "in_progress" } }),
      prisma.contact.count({ where: { date: { gte: startOfCurrentMonth } } }),
      prisma.client.count({
        where: {
          contacts: {
            none: {
              date: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
            },
          },
        },
      }),
    ]);

  const personalStats = sessionStaffId
    ? await getPersonalStats(sessionStaffId)
    : null;

  const [myActivity, allActivity] = await Promise.all([
    userId ? getRecentActivity(userId) : Promise.resolve([]),
    getRecentActivity(null),
  ]);

  const serializedMyActivity = myActivity.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }));
  const serializedAllActivity = allActivity.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() }));

  const serialized = todos.map((t) => ({
    id: t.id,
    date: t.date ? format(t.date, "yyyy-MM-dd") : null,
    createdAt: format(t.createdAt, "yyyy-MM-dd"),
    note: t.note,
    client: t.client ? { id: t.client.id, name: t.client.name } : null,
    staffInCharge: t.staffInCharge.map((s) => ({ id: s.id, name: s.name })),
  }));

  return (
    <PageContainer>
      <PageHeader title="首頁" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="族人總數"
          value={clientCount}
          icon={<Users className="h-5 w-5" />}
          href="/clients"
        />
        <StatCard
          title="進行中案件"
          value={activeCaseCount}
          icon={<FileText className="h-5 w-5" />}
          href="/cases"
        />
        <StatCard
          title="本月通聯"
          value={monthlyContactCount}
          icon={<Phone className="h-5 w-5" />}
          href="/contacts"
        />
        <StatCard
          title="久未聯繫"
          value={staleCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          href="/contacts/recent"
        />
      </div>

      {personalStats && <div className="mb-8"><PersonalStats stats={personalStats} /></div>}

      <div className="mb-8">
        <TodoDashboard todos={serialized} sessionStaffId={sessionStaffId} />
      </div>

      <RecentActivity myItems={serializedMyActivity} allItems={serializedAllActivity} hasUser={!!userId} />
    </PageContainer>
  );
}
