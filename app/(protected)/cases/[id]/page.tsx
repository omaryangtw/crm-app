import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/app/_lib/db";
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_MAJOR_LABELS,
  CASE_TYPE_MINOR_LABELS,
} from "@/app/_lib/constants/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";
import { InfoRow } from "@/app/_components/info-row";
import { CardStack } from "@/app/_components/card-stack";
import { InfoGrid } from "@/app/_components/info-grid";
import { SectionCard } from "@/app/_components/section-card";
import { DeleteCaseButton } from "./delete-case-button";
import HistoryViewer from "@/app/_components/history-viewer";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CaseDetailPage({ params }: Props) {
  const { id } = await params;
  const caseId = Number(id);
  if (Number.isNaN(caseId)) notFound();

  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    include: { client: true, staffInCharge: { select: { id: true, name: true } } },
  });

  if (!caseRecord) notFound();

  return (
    <PageContainer size="narrow">
      <BreadcrumbNav
        items={[
          { label: "案件", href: "/cases" },
          { label: caseRecord.name ?? "(未命名)" },
        ]}
      />

      <PageHeader
        title={`案件詳情 — ${caseRecord.name ?? "(未命名)"}`}
        actions={
          <>
            <Link href={`/cases/${caseRecord.id}/edit`}>
              <Button>編輯</Button>
            </Link>
            <DeleteCaseButton caseId={caseRecord.id} caseName={caseRecord.name} />
          </>
        }
      />

      <CardStack>
        {/* Associated client */}
        <SectionCard title="關聯族人">
          <Link
            href={`/clients/${caseRecord.client.id}`}
            className="text-primary hover:underline"
          >
            {caseRecord.client.name ?? "(未命名)"} (ID: {caseRecord.client.id})
          </Link>
        </SectionCard>

        {/* Case details */}
        <SectionCard title="案件資料">
          <InfoGrid className="text-sm">
            <InfoRow label="案件名稱" value={caseRecord.name} />
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">狀態</span>
              {caseRecord.status ? (
                <Badge variant={caseRecord.status === "in_progress" ? "default" : "secondary"}>
                  {CASE_STATUS_LABELS[caseRecord.status]}
                </Badge>
              ) : (
                <span className="text-foreground">—</span>
              )}
            </div>
            <InfoRow label="承辦人" value={caseRecord.staffInCharge.map((s) => s.name).join(", ") || null} />
            <InfoRow label="案件大類" value={caseRecord.typesMajor ? CASE_TYPE_MAJOR_LABELS[caseRecord.typesMajor] : null} />
            <InfoRow label="案件小類" value={caseRecord.typesMinor ? CASE_TYPE_MINOR_LABELS[caseRecord.typesMinor] : null} />
          </InfoGrid>
        </SectionCard>

        {/* Relations */}
        <SectionCard title="關係人">
          <InfoGrid columns="3" className="text-sm">
            <InfoRow label="關係人 1" value={caseRecord.relation1} />
            <InfoRow label="關係人 2" value={caseRecord.relation2} />
            <InfoRow label="關係人 3" value={caseRecord.relation3} />
          </InfoGrid>
        </SectionCard>

        {/* Contacts */}
        <SectionCard title="聯絡人">
          <InfoGrid columns="3" className="text-sm">
            <InfoRow label="聯絡人 1" value={caseRecord.contact1} />
            <InfoRow label="聯絡人 2" value={caseRecord.contact2} />
            <InfoRow label="聯絡人 3" value={caseRecord.contact3} />
          </InfoGrid>
        </SectionCard>

        {/* Notes (conditional) */}
        {caseRecord.note && (
          <SectionCard title="備註">
            <p className="text-sm whitespace-pre-wrap">{caseRecord.note}</p>
          </SectionCard>
        )}

        {/* Handle (conditional) */}
        {caseRecord.handle && (
          <SectionCard title="處理情形">
            <p className="text-sm whitespace-pre-wrap">{caseRecord.handle}</p>
          </SectionCard>
        )}
      </CardStack>

      <HistoryViewer entityType="Case" entityId={caseRecord.id} />
    </PageContainer>
  );
}
