import { notFound } from "next/navigation";
import { getStaffById } from "@/app/_lib/actions/staff-actions";
import EditStaffForm from "./edit-staff-form";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditStaffPage({ params }: Props) {
  const { id } = await params;
  const staffId = Number(id);
  if (Number.isNaN(staffId)) notFound();

  const staff = await getStaffById(staffId);
  if (!staff) notFound();

  const defaultValues = {
    name: staff.name,
    email: staff.email ?? "",
    phone: staff.phone ?? "",
    aliases: staff.aliases.join(", "),
  };

  return (
    <PageContainer size="narrow">
      <BreadcrumbNav
        items={[
          { label: "員工管理", href: "/staff" },
          { label: staff.name, href: `/staff/${id}` },
          { label: "編輯" },
        ]}
      />
      <PageHeader title={`編輯員工 — ${staff.name}`} />
      <EditStaffForm staffId={staffId} defaultValues={defaultValues} />
    </PageContainer>
  );
}
