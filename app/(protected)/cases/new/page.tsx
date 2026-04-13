"use client";

import { createCase } from "@/app/_lib/actions/case-actions";
import CaseForm from "../_components/case-form";

export default function NewCasePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-6">新增案件</h1>
      <CaseForm onSubmitAction={createCase} submitLabel="新增" />
    </div>
  );
}
