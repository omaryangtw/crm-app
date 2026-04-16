import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/app/_lib/db";
import { CONTACT_TYPE_LABELS } from "@/app/_lib/constants/enums";
import HistoryViewer from "@/app/_components/history-viewer";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";
import { InfoRow } from "@/app/_components/info-row";
import { InfoGrid } from "@/app/_components/info-grid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({ params }: Props) {
  const { id } = await params;
  const contactId = Number(id);
  if (Number.isNaN(contactId)) notFound();

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: {
      client: { select: { id: true, name: true } },
      staffInCharge: { select: { id: true, name: true } },
      case: { select: { id: true, name: true } },
    },
  });

  if (!contact) notFound();

  return (
    <PageContainer size="narrow">
      <BreadcrumbNav
        items={[
          { label: "通聯紀錄", href: "/contacts" },
          { label: "通聯詳情" },
        ]}
      />
      <PageHeader
        title="通聯詳情"
        actions={
          <Link href="/contacts">
            <Button variant="outline">返回列表</Button>
          </Link>
        }
      />

      {/* Associated client */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">關聯族人</CardTitle>
        </CardHeader>
        <CardContent>
          {contact.client ? (
            <Link
              href={`/clients/${contact.client.id}`}
              className="text-primary hover:underline"
            >
              {contact.client.name ?? "(未命名)"} (ID: {contact.client.id})
            </Link>
          ) : (
            <span className="text-muted-foreground">無關聯族人</span>
          )}
        </CardContent>
      </Card>

      {/* Contact details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>通聯資料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <InfoGrid className="text-sm">
            <InfoRow
              label="日期"
              value={
                contact.date
                  ? new Date(contact.date).toLocaleDateString("zh-TW")
                  : null
              }
            />
            <InfoRow
              label="類型"
              value={
                contact.contactType
                  ? (CONTACT_TYPE_LABELS[contact.contactType] ?? contact.contactType)
                  : null
              }
            />
            <InfoRow label="成功" value={contact.isSuccess ? "是" : "否"} />
            <InfoRow
              label="承辦人"
              value={
                contact.staffInCharge.map((s) => s.name).join(", ") || null
              }
            />
            <InfoRow
              label="關聯案件"
              value={contact.case?.name ?? null}
              href={contact.case ? `/cases/${contact.case.id}` : undefined}
            />
          </InfoGrid>
        </CardContent>
      </Card>

      {contact.record && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">紀錄</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-foreground whitespace-pre-wrap">
              {contact.record}
            </p>
          </CardContent>
        </Card>
      )}

      <HistoryViewer entityType="Contact" entityId={contact.id} />
    </PageContainer>
  );
}
