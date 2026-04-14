import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/app/_lib/db";
import { computeBirthdayFields } from "@/app/_lib/utils/date-utils";
import {
  SEX_LABELS,
  INCOME_STATUS_LABELS,
  DISABLED_STATUS_LABELS,
  INDIGENOUS_GROUP_LABELS,
  PLAIN_MOUNTAIN_LABELS,
  CASE_STATUS_LABELS,
  CASE_TYPE_MAJOR_LABELS,
  CONTACT_TYPE_LABELS,
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
import { ExpandableText } from "@/app/_components/expandable-text";
import { DetailLayout } from "@/app/_components/detail-layout";
import { CardStack } from "@/app/_components/card-stack";
import { InfoGrid } from "@/app/_components/info-grid";
import { SectionCard } from "@/app/_components/section-card";
import { DeleteClientButton } from "./delete-client-button";
import { FamilySection } from "./_components/family-section";
import HistoryViewer from "@/app/_components/history-viewer";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params;
  const clientId = Number(id);
  if (Number.isNaN(clientId)) notFound();

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      cases: {
        include: { staffInCharge: { select: { id: true, name: true } } },
      },
      contacts: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        include: { staffInCharge: { select: { id: true, name: true } } },
      },
      familyRelationsAsA: { include: { personB: true } },
      familyRelationsAsB: { include: { personA: true } },
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
        title={`族人詳情 — ${client.name ?? "(未命名)"}`}
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
          {/* Photo placeholder */}
          <div className="bg-muted rounded-lg p-4 flex items-center justify-center min-h-[200px]">
            <div className="text-center text-muted-foreground">
              <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" />
              </svg>
              <p className="mt-1 text-sm">照片</p>
            </div>
          </div>

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
                <InfoRow label="城市" value={client.city} />
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
                  <InfoRow label="城市" value={client.cityAlt} />
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

      {/* Cases section */}
      <SectionCard
        className="mb-8"
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

      {/* Contacts section */}
      <SectionCard
        className="mb-8"
        title="通聯紀錄"
        count={client.contacts.length}
        action={
          <Link href={`/contacts/new?clientId=${client.id}`}>
            <Button size="sm">新增通聯</Button>
          </Link>
        }
      >
          {client.contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無通聯紀錄</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>成功</TableHead>
                  <TableHead>紀錄</TableHead>
                  <TableHead>承辦人</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.contacts.map((ct) => (
                  <TableRow key={ct.id}>
                    <TableCell>
                      {ct.date ? format(ct.date, "yyyy-MM-dd") : "-"}
                    </TableCell>
                    <TableCell>
                      {ct.contactType ? CONTACT_TYPE_LABELS[ct.contactType] : "-"}
                    </TableCell>
                    <TableCell>{ct.isSuccess ? "是" : "否"}</TableCell>
                    <TableCell>
                      {ct.record ? <ExpandableText text={ct.record} /> : "-"}
                    </TableCell>
                    <TableCell>{ct.staffInCharge.map((s) => s.name).join(", ") || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </SectionCard>

      {/* Family relations section — interactive client component */}
      <FamilySection clientId={client.id} familyMembers={familyMembers} />

      {/* Audit log history */}
      <HistoryViewer entityType="Client" entityId={client.id} />
    </PageContainer>
  );
}
