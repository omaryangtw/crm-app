import { prisma } from "@/app/_lib/db";
import { format } from "date-fns";
import { TodoDashboard } from "./_components/todo-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const todos = await prisma.todo.findMany({
    where: { done: false },
    orderBy: { date: "asc" },
    include: {
      client: { select: { id: true, name: true } },
    },
  });

  const serialized = todos.map((t) => ({
    id: t.id,
    date: t.date ? format(t.date, "yyyy-MM-dd") : null,
    note: t.note,
    client: { id: t.client.id, name: t.client.name },
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-4">首頁</h1>
      <TodoDashboard todos={serialized} />
    </div>
  );
}
