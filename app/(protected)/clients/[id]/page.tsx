import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/app/_lib/db";
import { auth } from "@/app/_lib/auth";
import { computeBirthdayFields } from "@/app/_lib/utils/date-utils";
import {
  SEX_LABELS,
  INCOME_STATUS_LABELS,
  DISABLED_STATUS_LABELS,
  INDIGENOUS_GROUP_LABELS,
  PLAIN_MOUNTAIN_LABELS,
  CASE_STATUS_LABELS,
  CASE_TYPE_MAJOR_LABELS,
} from "@/app/_lib/constants/enums";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/app/_components/page-container";
import { PageHeader } from "@/app/_components/page-header";
import { BreadcrumbNav } from "@/app/_components/breadcrumb-nav";
import { InfoRow } from "@/app/_components/info-row";
import { DetailLayout } from "@/app/_components/detail-layout";
import { CardStack } from "@/app/_components/card-stack";
import { InfoGrid } from "@/app/_components/info-grid";
import { SectionCard } from "@/app/_components/section-card";
import { User } from "lucide-react";
import { DeleteClientButton } from "./delete-client-button";
import { FamilySection } from "./_components/family-section";
import { ContactsSection } from "./_components/contacts-section";
import { PhotoVersionSwitcher } from "./_components/photo-version-switcher";
import HistoryViewer from "@/app/_components/history-viewer";
import ClientDetailTabs from "./_components/client-detail-tabs";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const clientId = Number(id);
  if (Number.isNaN(clientId)) notFound();

  const session = await auth();
  const sessionStaffId = session?.user?.staffId ?? null;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      cases: {
        orderBy: { updatedAt: "desc" },
        include: { staffInCharge: { select: { id: true, name: true } } },
      },
      contacts: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: {
          staffInCharge: { select: { id: true, name: true } },
          case: { select: { id: true, name: true } },
        },
      },
      familyRelationsAsA: { include: { personB: true } },
      familyRelationsAsB: { include: { personA: true } },
      photos: { orderBy: { version: "desc" } },
    },
  });

  if (!client) notFound();

  const birthday = computeBirthdayFields(client.birthday);

  // Merge family relations from both directions
  const familyMembers = [
    ...client.familyRelationsAsA.map((r) => ({
      id: r.id,
      personId: r.personB.id,
      personName: r.personB.name ?? "(未命名)",
      relationship: r.relationAToB,
    })),
    ...client.familyRelationsAsB.map((r) => ({
      id: r.id,
      personId: r.personA.id,
      personName: r.personA.name ?? "(未命名)",
      relationship: r.relationBToA,
    })),
  ];

  return (
    <PageContainer>
      <BreadcrumbNav
        items={[
          { label: "族人", href: "/clients" },
          { label: client.name ?? "(未命名)" },
        ]}
      />

      <PageHeader
        title={`族人詳情 — ${client.name ?? "(未命名)"}${client.isDead ? " (已歿)" : ""}`}
        actions={
          <>
            <Link href={`/clients/${client.id}/edit`}>
              <Button>編輯</Button>
            </Link>
            <DeleteClientButton clientId={client.id} clientName={client.name} />
          </>
        }
      />

      {/* Two-column layout: left = photo + basic info, right = contact cards */}
      <DetailLayout className="mb-8" sidebar={
        <div className="space-y-4">
          {/* Photo section */}
          {client.photos.length > 0 ? (
            <PhotoVersionSwitcher photos={client.photos} clientName={client.name ?? "(未命名)"} />
          ) : (
            <div className="flex items-center justify-center">
              <div className="bg-muted rounded-full flex items-center justify-center" style={{ width: 96, height: 96 }}>
                <User className="h-12 w-12 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Basic info card */}
          <Card>
            <CardHeader>
              <CardTitle>基本資料</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <InfoRow label="姓名" value={client.name} />
              {client.nameAlt && <InfoRow label="別名" value={client.nameAlt} />}
              <InfoRow label="性別" value={client.sex ? SEX_LABELS[client.sex] : null} />
              <InfoRow
                label="生日"
                value={client.birthday ? format(client.birthday, "yyyy-MM-dd") : null}
              />
              {birthday.age !== null && (
                <InfoRow label="年齡" value={`${birthday.age} 歲`} />
              )}
              <InfoRow label="身分證號" value={client.idn} />
              <InfoRow
                label="族別"
                value={client.indigenousGroup ? INDIGENOUS_GROUP_LABELS[client.indigenousGroup] : null}
              />
              <InfoRow label="部落" value={client.tribe} />
              <InfoRow
                label="平原/山原"
                value={client.plainMountain ? PLAIN_MOUNTAIN_LABELS[client.plainMountain] : null}
              />
              <InfoRow
                label="收入狀況"
                value={client.incomeStatus ? INCOME_STATUS_LABELS[client.incomeStatus] : null}
              />
              <InfoRow
                label="身心障礙"
                value={client.disabledStatus ? DISABLED_STATUS_LABELS[client.disabledStatus] : null}
              />
              <InfoRow label="死亡" value={client.isDead ? "是" : "否"} highlight={client.isDead} />
              <InfoRow label="戶長" value={client.householdAdmin ? "是" : "否"} />
            </CardContent>
          </Card>
        </div>
      }>
        <CardStack>
          {/* Card 1: 聯絡方式 */}
          <Card>
            <CardHeader>
              <CardTitle>聯絡方式</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoGrid className="text-sm">
                <InfoRow label="電話可否" value={client.canCall ? "可" : "不可"} />
                <InfoRow label="郵寄可否" value={client.canMail ? "可" : "不可"} />
                <InfoRow label="手機" value={client.mobile} />
                <InfoRow label="手機備註" value={client.mobileNote} />
                <InfoRow label="手機2" value={client.mobileAlt} />
                <InfoRow label="手機2備註" value={client.mobileAltNote} />
                <InfoRow label="電話" value={client.phone} />
                <InfoRow label="電話備註" value={client.phoneNote} />
                <InfoRow label="電話2" value={client.phoneAlt} />
                <InfoRow label="電話2備註" value={client.phoneAltNote} />
              </InfoGrid>
            </CardContent>
          </Card>

          {/* Card 2: 地址 */}
          <Card>
            <CardHeader>
              <CardTitle>地址</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoGrid className="text-sm">
                <InfoRow label="縣市" value={client.city} />
                <InfoRow label="區域" value={client.dist} />
                <InfoRow label="里" value={client.vill} />
                <InfoRow label="地址" value={client.addr} />
                <InfoRow label="地址備註" value={client.addrNote} />
              </InfoGrid>
            </CardContent>
          </Card>

          {/* Card 3: 第二地址 (conditional) */}
          {(client.cityAlt || client.distAlt || client.villAlt || client.addrAlt) && (
            <Card>
              <CardHeader>
                <CardTitle>第二地址</CardTitle>
              </CardHeader>
              <CardContent>
                <InfoGrid className="text-sm">
                  <InfoRow label="縣市" value={client.cityAlt} />
                  <InfoRow label="區域" value={client.distAlt} />
                  <InfoRow label="里" value={client.villAlt} />
                  <InfoRow label="地址" value={client.addrAlt} />
                  <InfoRow label="地址備註" value={client.addrAltNote} />
                </InfoGrid>
              </CardContent>
            </Card>
          )}

          {/* Card 4: 備註 (conditional) */}
          {client.note && (
            <Card>
              <CardHeader>
                <CardTitle>備註</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{client.note}</p>
              </CardContent>
            </Card>
          )}
        </CardStack>
      </DetailLayout>

      {/* Bottom sections wrapped in Tab navigation */}
      <ClientDetailTabs
        clientId={client.id}
        sessionStaffId={sessionStaffId}
        counts={{
          cases: client.cases.length,
          contacts: client.contacts.length,
          family: familyMembers.length,
        }}
        casesContent={
          <SectionCard
            title="案件紀錄"
            count={client.cases.length}
            action={
              <Link href={`/cases/new?clientId=${client.id}`}>
                <Button size="sm">新增案件</Button>
              </Link>
            }
          >
            {client.cases.length === 0 ? (
              <p className="text-sm text-muted-foreground">尚無案件紀錄</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>案件名稱</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>類型</TableHead>
                    <TableHead>承辦人</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {client.cases.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.name ?? "-"}</TableCell>
                      <TableCell>
                        {c.status ? (
                          <Badge variant={c.status === "in_progress" ? "default" : "secondary"}>
                            {CASE_STATUS_LABELS[c.status]}
                          </Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {c.typesMajor ? CASE_TYPE_MAJOR_LABELS[c.typesMajor] : "-"}
                      </TableCell>
                      <TableCell>{c.staffInCharge.map((s) => s.name).join(", ") || "-"}</TableCell>
                      <TableCell>
                        <Link
                          href={`/cases/${c.id}`}
                          className="text-primary hover:underline"
                        >
                          查看
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        }
        contactsContent={
          <ContactsSection
            clientId={client.id}
            sessionStaffId={sessionStaffId}
            contacts={client.contacts}
          />
        }
        familyContent={
          <FamilySection clientId={client.id} familyMembers={familyMembers} />
        }
        historyContent={
          <HistoryViewer entityType="Client" entityId={client.id} />
        }
      />
    </PageContainer>
  );
}
