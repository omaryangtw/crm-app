import { notFound } from "next/navigation";
import Link from "next/link";
import { getStaffById } from "@/app/_lib/actions/staff-actions";
import { DeactivateStaffButton } from "./deactivate-staff-button";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StaffDetailPage({ params }: Props) {
  const { id } = await params;
  const staffId = Number(id);
  if (Number.isNaN(staffId)) notFound();

  const staff = await getStaffById(staffId);
  if (!staff) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">
          員工詳情 — {staff.name}
        </h1>
        <div className="flex gap-3">
          <Link
            href={`/staff/${staff.id}/edit`}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            編輯
          </Link>
          {staff.isActive && (
            <DeactivateStaffButton staffId={staff.id} staffName={staff.name} />
          )}
        </div>
      </div>

      {/* Staff details */}
      <div className="rounded-lg border bg-card p-4 shadow-sm space-y-3 text-sm">
        <h2 className="text-lg font-semibold mb-2">員工資料</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          <InfoRow label="姓名" value={staff.name} />
          <InfoRow label="別名" value={staff.aliases.length > 0 ? staff.aliases.join(", ") : null} />
          <InfoRow label="電子郵件" value={staff.email} />
          <InfoRow label="電話" value={staff.phone} />
          <InfoRow
            label="狀態"
            value={staff.isActive ? "啟用" : "已停用"}
          />
          <InfoRow
            label="建立時間"
            value={staff.createdAt.toLocaleString("zh-TW")}
          />
          <InfoRow
            label="更新時間"
            value={staff.updatedAt.toLocaleString("zh-TW")}
          />
        </div>
      </div>

      {/* Back link */}
      <div className="mt-6">
        <Link
          href="/staff"
          className="text-indigo-600 hover:underline text-sm"
        >
          ← 返回列表
        </Link>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex justify-between">
      <span className="font-semibold text-gray-600">{label}</span>
      <span className="text-gray-800">{value ?? "-"}</span>
    </div>
  );
}
