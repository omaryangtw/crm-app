import Link from "next/link";
import { prisma } from "@/app/_lib/db";
import { ContactTable } from "./contact-table";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function ContactsPage({ searchParams }: Props) {
  const { q } = await searchParams;

  const contacts = await prisma.contact.findMany({
    where: q
      ? { record: { contains: q, mode: "insensitive" } }
      : undefined,
    take: q ? undefined : 50,
    orderBy: { createdAt: "desc" },
    include: {
      client: { select: { id: true, name: true } },
      staffInCharge: { select: { id: true, name: true } },
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">通聯紀錄</h1>
        <Link
          href="/contacts/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          新增通聯
        </Link>
      </div>
      <ContactTable contacts={contacts} />
    </div>
  );
}
