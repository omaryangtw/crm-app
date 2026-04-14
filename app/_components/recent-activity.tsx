import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/app/_components/section-card";
import { formatRelativeTime, buildEntityHref } from "@/app/_lib/utils/search-utils";
import type { RecentActivityItem } from "@/app/_lib/actions/dashboard-actions";

const ACTION_BADGE_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  CREATE: { label: "新增", variant: "default" },
  UPDATE: { label: "修改", variant: "secondary" },
  DELETE: { label: "刪除", variant: "destructive" },
};

const ENTITY_TYPE_LABEL: Record<string, string> = {
  Client: "族人",
  Case: "案件",
  Contact: "通聯紀錄",
};

interface RecentActivityProps {
  items: RecentActivityItem[];
}

export function RecentActivity({ items }: RecentActivityProps) {
  return (
    <SectionCard title="最近操作">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">尚無操作紀錄</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => {
            const badge = ACTION_BADGE_MAP[item.action] ?? { label: item.action, variant: "default" as const };
            const entityLabel = ENTITY_TYPE_LABEL[item.entityType] ?? item.entityType;
            const isDelete = item.action === "DELETE";

            const content = (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                  <span className="text-sm text-muted-foreground shrink-0">{entityLabel}</span>
                  <span className={`text-sm truncate ${isDelete ? "line-through opacity-50" : ""}`}>
                    {item.entityName}
                    {item.clientName && (
                      <span className="text-muted-foreground"> — {item.clientName}</span>
                    )}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatRelativeTime(new Date(item.createdAt))}
                </span>
              </div>
            );

            return (
              <li key={item.id}>
                {isDelete ? (
                  <div className="line-through opacity-50">{content}</div>
                ) : (
                  <Link
                    href={buildEntityHref(item.entityType, item.entityId)}
                    className="block rounded-md p-1 -m-1 hover:bg-muted transition-colors"
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
