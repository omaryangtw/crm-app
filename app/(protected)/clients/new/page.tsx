"use client";

import { createClient } from "@/app/_lib/actions/client-actions";
import ClientForm from "../_components/client-form";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-6">新增族人</h1>
      <ClientForm
        onSubmitAction={createClient}
        submitLabel="新增"
      />
    </div>
  );
}
