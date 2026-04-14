"use client";

import { updateClient } from "@/app/_lib/actions/client-actions";
import ClientForm from "../../_components/client-form";
import type { ClientCreateInput } from "@/app/_lib/schemas/client-schema";

interface Props {
  clientId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValues: Record<string, any>;
  photos: Array<{ id: number; photoPath: string; originalPhotoPath: string; version: number }>;
}

export default function EditClientForm({ clientId, defaultValues, photos }: Props) {
  async function handleSubmit(formData: FormData) {
    return updateClient(clientId, formData);
  }

  return (
    <ClientForm
      defaultValues={defaultValues}
      onSubmitAction={handleSubmit}
      submitLabel="儲存"
      clientId={clientId}
      photos={photos}
    />
  );
}
