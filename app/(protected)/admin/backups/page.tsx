import { redirect } from "next/navigation";
import { auth } from "@/app/_lib/auth";
import { listBackups } from "@/app/_lib/utils/backup";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";
import { BackupListTable } from "./_components/backup-list-table";

export default async function BackupsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "admin") redirect("/");

  const backups = await listBackups();

  return (
    <PageContainer>
      <BreadcrumbNav
        items={[
          { label: "首頁", href: "/" },
          { label: "備份管理" },
        ]}
      />

      <PageHeader title="備份管理" />

      <BackupListTable backups={backups} />
    </PageContainer>
  );
}
