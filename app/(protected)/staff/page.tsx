import Link from "next/link";
import { getStaffList } from "@/app/_lib/actions/staff-actions";
import { StaffTable } from "./staff-table";

export default async function StaffPage() {
  const staff = await getStaffList();

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">員工列表</h1>
        <Link
          href="/staff/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          新增員工
        </Link>
      </div>
      <StaffTable staff={staff} />
    </div>
  );
}
