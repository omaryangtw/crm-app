import { notFound } from "next/navigation";
import { format } from "date-fns";
import { prisma } from "@/app/_lib/db";
import EditClientForm from "./edit-client-form";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";

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
    <PageContainer size="narrow">
      <BreadcrumbNav
        items={[
          { label: "族人", href: "/clients" },
          { label: client.name ?? "(未命名)", href: `/clients/${id}` },
          { label: "編輯" },
        ]}
      />
      <PageHeader title={`編輯族人 — ${client.name}`} />
      <EditClientForm clientId={clientId} defaultValues={defaultValues} />
    </PageContainer>
  );
}
