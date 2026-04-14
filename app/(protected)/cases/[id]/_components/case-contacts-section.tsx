"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/app/_components/section-card";
import { CaseContactTimeline } from "./case-contact-timeline";
import QuickContactForm from "@/app/_components/quick-contact-form";

interface ContactRow {
  id: number;
  date: Date | null;
  contactType: string | null;
  isSuccess: boolean;
  record: string | null;
  staffInCharge: { id: number; name: string }[];
}

interface CaseContactsSectionProps {
  caseId: number;
  clientId: number;
  sessionStaffId: number | null;
  contacts: ContactRow[];
}

export function CaseContactsSection({
  caseId,
  clientId,
  sessionStaffId,
  contacts,
}: CaseContactsSectionProps) {
  const [showQuickForm, setShowQuickForm] = useState(false);

  return (
    <SectionCard
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
          <Link href={`/contacts/new?clientId=${clientId}&caseId=${caseId}`}>
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
            defaultCaseId={caseId}
            onSuccess={() => setShowQuickForm(false)}
          />
        </div>
      )}

      <CaseContactTimeline contacts={contacts} />
    </SectionCard>
  );
}
