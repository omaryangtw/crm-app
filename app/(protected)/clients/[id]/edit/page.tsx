import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/app/_lib/db";
import EditClientForm from "./edit-client-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditClientPage({ params }: Props) {
  const { id } = await params;
  const clientId = Number(id);
  if (Number.isNaN(clientId)) notFound();

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) notFound();

  // Convert Date to ISO string for the HTML date input
  const defaultValues = {
    ...client,
    birthday: client.birthday ? format(client.birthday, "yyyy-MM-dd") : undefined,
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-xl font-semibold mb-6">編輯族人 — {client.name}</h1>
      <EditClientForm clientId={clientId} defaultValues={defaultValues} />
    </div>
  );
}
