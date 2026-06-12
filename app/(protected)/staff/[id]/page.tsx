import { notFound } from "next/navigation";
import Link from "next/link";
import { getStaffById } from "@/app/_lib/actions/staff-actions";
import { auth } from "@/app/_lib/auth";
import { prisma } from "@/app/_lib/db";
import { DeactivateStaffButton } from "./deactivate-staff-button";
import { ActivateStaffButton } from "./activate-staff-button";
import StaffBindingSection from "./_components/staff-binding-section";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";
import { InfoRow } from "@/app/_components/info-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardStack } from "@/app/_components/card-stack";
import { InfoGrid } from "@/app/_components/info-grid";
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

  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  // Query the User bound to this Staff (if any)
  let boundUser: { id: number; email: string; role: string } | null = null;
  if (isAdmin) {
    const user = await prisma.user.findUnique({
      where: { staffId },
      select: { id: true, email: true, role: true },
    });
    boundUser = user;
  }

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
            {staff.isActive ? (
              <DeactivateStaffButton staffId={staff.id} staffName={staff.name} />
            ) : (
              <ActivateStaffButton staffId={staff.id} staffName={staff.name} />
            )}
          </div>
        }
      />

      <CardStack>
        {/* Staff details */}
        <Card>
          <CardHeader>
            <CardTitle>員工資料</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoGrid className="text-sm">
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
            </InfoGrid>
          </CardContent>
        </Card>

        {/* Binding section — admin only */}
        {isAdmin && (
          <StaffBindingSection staffId={staffId} boundUser={boundUser} />
        )}
      </CardStack>
    </PageContainer>
  );
}
