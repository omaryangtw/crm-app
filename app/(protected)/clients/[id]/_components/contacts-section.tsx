"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SectionCard } from "@/app/_components/section-card";
import { ExpandableText } from "@/app/_components/expandable-text";
import { CONTACT_TYPE_LABELS } from "@/app/_lib/constants/enums";
import QuickContactForm from "@/app/_components/quick-contact-form";

interface ContactRow {
  id: number;
  date: Date | null;
  contactType: string | null;
  isSuccess: boolean;
  record: string | null;
  staffInCharge: { id: number; name: string }[];
  case?: { id: number; name: string | null } | null;
}

interface ContactsSectionProps {
  clientId: number;
  sessionStaffId: number | null;
  contacts: ContactRow[];
}

export function ContactsSection({
  clientId,
  sessionStaffId,
  contacts,
}: ContactsSectionProps) {
  const [showQuickForm, setShowQuickForm] = useState(false);

  return (
    <SectionCard
      className="mb-8"
      title="通聯紀錄"
      count={contacts.length}
      action={
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowQuickForm(!showQuickForm)}
          >
            {showQuickForm ? "收合" : "快速通聯"}
          </Button>
          <Link href={`/contacts/new?clientId=${clientId}`}>
            <Button size="sm">新增通聯</Button>
          </Link>
        </div>
      }
    >
      {showQuickForm && (
        <div className="mb-4 rounded-lg border bg-muted/50 p-4">
          <QuickContactForm
            clientId={clientId}
            sessionStaffId={sessionStaffId}
            onSuccess={() => setShowQuickForm(false)}
          />
        </div>
      )}

      {contacts.length === 0 ? (
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
              <TableHead>關聯案件</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((ct) => (
              <TableRow key={ct.id}>
                <TableCell>
                  {ct.date ? format(ct.date, "yyyy-MM-dd") : "-"}
                </TableCell>
                <TableCell>
                  {ct.contactType
                    ? CONTACT_TYPE_LABELS[ct.contactType]
                    : "-"}
                </TableCell>
                <TableCell>{ct.isSuccess ? "是" : "否"}</TableCell>
                <TableCell>
                  {ct.record ? <ExpandableText text={ct.record} /> : "-"}
                </TableCell>
                <TableCell>
                  {ct.staffInCharge.map((s) => s.name).join(", ") || "-"}
                </TableCell>
                <TableCell>
                  {ct.case?.id ? (
                    <Link
                      href={`/cases/${ct.case.id}`}
                      className="text-primary hover:underline"
                    >
                      {ct.case.name ?? "(未命名)"}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}
