import { prisma } from "@/app/_lib/db";
import { computeBirthdayFields } from "@/app/_lib/utils/date-utils";
import { BirthdayTable } from "./birthday-table";

export interface BirthdayClientRow {
  id: number;
  name: string | null;
  birthday: string; // ISO date string for serialization
  age: number | null;
  phone: string | null;
  mobile: string | null;
  dist: string | null;
  vill: string | null;
  addr: string | null;
  canMail: boolean;
  birthMonth: number | null;
  birthDay: number | null;
}

export default async function BirthdayPage() {
  const clients = await prisma.client.findMany({
    where: {
      id: { not: 0 },
      birthday: { not: null },
      addr: { not: null },
      OR: [{ phone: { not: null } }, { mobile: { not: null } }],
    },
    select: {
      id: true,
      name: true,
      birthday: true,
      phone: true,
      mobile: true,
      dist: true,
      vill: true,
      addr: true,
      canMail: true,
    },
    orderBy: { birthday: "asc" },
  });

  const rows: BirthdayClientRow[] = clients.map((c) => {
    const fields = computeBirthdayFields(c.birthday);
    return {
      id: c.id,
      name: c.name,
      birthday: c.birthday!.toISOString(),
      age: fields.age,
      phone: c.phone,
      mobile: c.mobile,
      dist: c.dist,
      vill: c.vill,
      addr: c.addr,
      canMail: c.canMail,
      birthMonth: fields.birthMonth,
      birthDay: fields.birthDay,
    };
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-4">生日清單</h1>
      <BirthdayTable clients={rows} />
    </div>
  );
}
