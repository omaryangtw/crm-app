import { getAuditLogs } from "@/app/_lib/audit/audit-queries";
import type { EntityType } from "@/app/_lib/audit/audit-types";
import { Badge } from "@/components/ui/badge";

type AuditEntry = Awaited<ReturnType<typeof getAuditLogs>>["entries"][number];

interface HistoryViewerProps {
  entityType: EntityType;
  entityId: number;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "新增",
  UPDATE: "修改",
  DELETE: "刪除",
};

const ACTION_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  CREATE: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
};

/** Map camelCase DB field names to human-readable Chinese labels */
const FIELD_LABELS: Record<string, string> = {
  // Client
  name: "姓名",
  nameAlt: "別名",
  idn: "身分證號",
  sex: "性別",
  birthday: "生日",
  isDead: "已歿",
  householdAdmin: "戶長",
  incomeStatus: "收入狀況",
  disabledStatus: "身心障礙",
  indigenousGroup: "族別",
  tribe: "部落",
  plainMountain: "平原/山原",
  canCall: "電話可否",
  phone: "電話",
  phoneNote: "電話備註",
  phoneAlt: "電話（備用）",
  phoneAltNote: "電話（備用）備註",
  mobile: "手機",
  mobileNote: "手機備註",
  mobileAlt: "手機（備用）",
  mobileAltNote: "手機（備用）備註",
  canMail: "郵寄可否",
  city: "縣市",
  cityAlt: "縣市（備用）",
  dist: "區域",
  distAlt: "區域（備用）",
  vill: "里",
  villAlt: "里（備用）",
  addr: "地址",
  addrAlt: "地址（備用）",
  addrNote: "地址備註",
  addrAltNote: "地址（備用）備註",
  note: "備註",
  照片: "照片",
  // Case
  status: "狀態",
  personInChargeLegacy: "承辦人（舊）",
  staffInCharge: "承辦人",
  typesMajor: "主類型",
  typesMinor: "次類型",
  relation1: "關係人1",
  relation2: "關係人2",
  relation3: "關係人3",
  contact1: "聯絡人1",
  contact2: "聯絡人2",
  contact3: "聯絡人3",
  handle: "處遇方式",
  clientId: "族人",
  // Contact
  date: "日期",
  contactType: "通聯方式",
  isSuccess: "是否成功",
  record: "紀錄內容",
  caseId: "案件",
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function formatTimestamp(date: Date): string {
  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function HistoryViewer({
  entityType,
  entityId,
}: HistoryViewerProps) {
  const { entries } = await getAuditLogs({ entityType, entityId });

  return (
    <div className="bg-card rounded-lg shadow">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold">變更歷史</h2>
      </div>

      {entries.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">目前沒有變更紀錄</div>
      ) : (
        <div className="divide-y divide-border">
          {entries.map((entry: AuditEntry) => {
            const isUpdate = entry.action === "UPDATE";
            const oldData = entry.oldData as Record<string, unknown> | null;
            const newData = entry.newData as Record<string, unknown> | null;

            return (
              <details key={entry.id} className="group">
                <summary className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/50 list-none [&::-webkit-details-marker]:hidden">
                  <Badge variant={ACTION_BADGE_VARIANT[entry.action] ?? "outline"}>
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </Badge>
                  <span className="text-sm text-foreground">{entry.userEmail}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatTimestamp(entry.createdAt)}
                  </span>
                  {isUpdate && entry.changedFields.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {entry.changedFields.map(fieldLabel).join(", ")}
                    </span>
                  )}
                </summary>

                {isUpdate && entry.changedFields.length > 0 && (oldData || newData) && (
                  <div className="px-4 pb-4">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b border-border">
                          <th className="py-1 pr-4 font-medium">變更欄位</th>
                          <th className="py-1 pr-4 font-medium">舊值</th>
                          <th className="py-1 font-medium">新值</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.changedFields.map((field: string) => (
                          <tr key={field} className="border-b border-border last:border-b-0">
                            <td className="py-1.5 pr-4 font-medium text-foreground">
                              {fieldLabel(field)}
                            </td>
                            <td className="py-1.5 pr-4 text-destructive break-all">
                              {formatValue(oldData?.[field])}
                            </td>
                            <td className="py-1.5 text-primary break-all">
                              {formatValue(newData?.[field])}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
