"use client";

import { updateStaff } from "@/app/_lib/actions/staff-actions";
import StaffForm from "../../_components/staff-form";

interface Props {
  staffId: number;
  defaultValues: Record<string, string>;
}

export default function EditStaffForm({ staffId, defaultValues }: Props) {
  const boundUpdateStaff = updateStaff.bind(null, staffId);

  return (
    <StaffForm
      defaultValues={defaultValues}
      onSubmitAction={boundUpdateStaff}
      submitLabel="儲存"
    />
  );
}
