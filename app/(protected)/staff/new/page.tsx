"use client";

import { createStaff } from "@/app/_lib/actions/staff-actions";
import StaffForm from "../_components/staff-form";

export default function NewStaffPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-6">新增員工</h1>
      <StaffForm onSubmitAction={createStaff} submitLabel="新增" />
    </div>
  );
}
