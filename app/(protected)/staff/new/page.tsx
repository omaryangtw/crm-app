"use client";

import { createStaff } from "@/app/_lib/actions/staff-actions";
import StaffForm from "../_components/staff-form";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";

export default function NewStaffPage() {
  return (
    <PageContainer size="narrow">
      <BreadcrumbNav items={[{ label: "員工管理", href: "/staff" }, { label: "新增" }]} />
      <PageHeader title="新增員工" />
      <StaffForm onSubmitAction={createStaff} submitLabel="新增" />
    </PageContainer>
  );
}
