"use client";

import { useSearchParams } from "next/navigation";
import { createContact } from "@/app/_lib/actions/contact-actions";
import ContactForm from "../_components/contact-form";

export default function NewContactPage() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("clientId");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-6">新增通聯紀錄</h1>
      <ContactForm
        onSubmitAction={createContact}
        submitLabel="新增"
        clientId={clientId ? Number(clientId) : undefined}
      />
    </div>
  );
}
