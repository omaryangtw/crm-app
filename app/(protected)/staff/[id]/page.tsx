import { notFound } from "next/navigation";
import Link from "next/link";
import { getStaffById } from "@/app/_lib/actions/staff-actions";
import { DeactivateStaffButton } from "./deactivate-staff-button";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";
import { InfoRow } from "@/app/_components/info-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    <PageContainer size="narrow">
      <BreadcrumbNav
        items={[
          { label: "員工管理", href: "/staff" },
          { label: staff.name },
        ]}
      />
      <PageHeader
        title={`員工詳情 — ${staff.name}`}
        actions={
          <div className="flex gap-3">
            <Link href={`/staff/${staff.id}/edit`}>
              <Button>編輯</Button>
            </Link>
            {staff.isActive && (
              <DeactivateStaffButton staffId={staff.id} staffName={staff.name} />
            )}
          </div>
        }
      />

      {/* Staff details */}
      <Card>
        <CardHeader>
          <CardTitle>員工資料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
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
        </CardContent>
      </Card>
    </PageContainer>
  );
}
