"use client";

import { updateCase } from "@/app/_lib/actions/case-actions";
import CaseForm from "../../_components/case-form";

interface Props {
  caseId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValues: Record<string, any>;
}

export default function EditCaseForm({ caseId, defaultValues }: Props) {
  async function handleSubmit(formData: FormData) {
    return updateCase(caseId, formData);
  }

  return (
    <CaseForm
      defaultValues={defaultValues}
      onSubmitAction={handleSubmit}
      submitLabel="儲存"
    />
  );
}
