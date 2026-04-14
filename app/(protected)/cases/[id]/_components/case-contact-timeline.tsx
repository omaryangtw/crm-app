import { Badge } from "@/components/ui/badge";
import { ExpandableText } from "@/app/_components/expandable-text";
import { EmptyState } from "@/app/_components/empty-state";
import { CONTACT_TYPE_LABELS } from "@/app/_lib/constants/enums";
import { Phone } from "lucide-react";

interface CaseContactTimelineProps {
  contacts: {
    id: number;
    date: Date | null;
    contactType: string | null;
    isSuccess: boolean;
    record: string | null;
    staffInCharge: { id: number; name: string }[];
  }[];
}

export function CaseContactTimeline({ contacts }: CaseContactTimelineProps) {
  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={<Phone />}
        title="尚無通聯紀錄"
      />
    );
  }

  // Sort by date descending (newest first), nulls last
  const sorted = [...contacts].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="relative ml-3 border-l-2 border-border pl-6 space-y-6">
      {sorted.map((contact) => (
        <div key={contact.id} className="relative">
          {/* Timeline dot */}
          <div className="absolute -left-[31px] top-1 h-3 w-3 rounded-full bg-primary" />

          {/* Date */}
          <p className="text-sm font-medium text-foreground">
            {contact.date
              ? new Date(contact.date).toLocaleDateString("zh-TW")
              : "—"}
          </p>

          {/* Contact type badge + success indicator */}
          <div className="mt-1 flex items-center gap-2">
            {contact.contactType && (
              <Badge variant="secondary">
                {CONTACT_TYPE_LABELS[contact.contactType] ?? contact.contactType}
              </Badge>
            )}
            <span className="text-sm text-muted-foreground">
              {contact.isSuccess ? "✓ 成功" : "✗ 未成功"}
            </span>
          </div>

          {/* Record summary */}
          {contact.record && (
            <div className="mt-1 text-sm text-muted-foreground">
              <ExpandableText text={contact.record} />
            </div>
          )}

          {/* Staff in charge */}
          {contact.staffInCharge.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              承辦人：{contact.staffInCharge.map((s) => s.name).join("、")}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
