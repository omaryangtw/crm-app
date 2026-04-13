import { getAuditLogs } from "@/app/_lib/audit/audit-queries";
import type { EntityType } from "@/app/_lib/audit/audit-types";

interface HistoryViewerProps {
  entityType: EntityType;
  entityId: number;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "新增",
  UPDATE: "修改",
  DELETE: "刪除",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
};

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
    <div className="bg-white rounded-lg shadow">
      <div className="px-4 py-3 border-b">
        <h2 className="text-lg font-semibold">變更歷史</h2>
      </div>

      {entries.length === 0 ? (
        <div className="p-8 text-center text-gray-500">目前沒有變更紀錄</div>
      ) : (
        <div className="divide-y">
          {entries.map((entry) => {
            const isUpdate = entry.action === "UPDATE";
            const oldData = entry.oldData as Record<string, unknown> | null;
            const newData = entry.newData as Record<string, unknown> | null;

            return (
              <details key={entry.id} className="group">
                <summary className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50 list-none [&::-webkit-details-marker]:hidden">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[entry.action] ?? "bg-gray-100 text-gray-800"}`}
                  >
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </span>
                  <span className="text-sm text-gray-700">{entry.userEmail}</span>
                  <span className="text-sm text-gray-500">
                    {formatTimestamp(entry.createdAt)}
                  </span>
                  {isUpdate && entry.changedFields.length > 0 && (
                    <span className="text-xs text-gray-400">
                      {entry.changedFields.join(", ")}
                    </span>
                  )}
                </summary>

                {isUpdate && oldData && newData && entry.changedFields.length > 0 && (
                  <div className="px-4 pb-4">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="text-left text-gray-500 border-b">
                          <th className="py-1 pr-4 font-medium">變更欄位</th>
                          <th className="py-1 pr-4 font-medium">舊值</th>
                          <th className="py-1 font-medium">新值</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.changedFields.map((field) => (
                          <tr key={field} className="border-b last:border-b-0">
                            <td className="py-1.5 pr-4 font-medium text-gray-700">
                              {field}
                            </td>
                            <td className="py-1.5 pr-4 text-red-600 break-all">
                              {formatValue(oldData[field])}
                            </td>
                            <td className="py-1.5 text-green-600 break-all">
                              {formatValue(newData[field])}
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
