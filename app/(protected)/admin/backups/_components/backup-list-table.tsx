"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BackupListItem } from "@/app/_lib/utils/backup";
import { RestorePreviewDialog } from "./restore-preview-dialog";

interface BackupListTableProps {
  backups: BackupListItem[];
}

/* ── Helpers ── */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function summarizeTableCounts(
  tables: BackupListItem["tables"]
): string {
  if (!tables || tables.length === 0) return "—";
  const total = tables.reduce((sum, t) => sum + t.actualCount, 0);
  return `${tables.length} 表 / ${total} 筆`;
}

/* ── Main component ── */

export function BackupListTable({ backups }: BackupListTableProps) {
  const router = useRouter();
  const [backingUp, startBackup] = useTransition();
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);

  const handleBackup = () => {
    startBackup(async () => {
      try {
        const res = await fetch("/api/backup", { method: "POST" });
        if (!res.ok && res.status !== 207) {
          throw new Error("備份失敗");
        }
        const data = await res.json();
        if (data.metadata?.status === "partial") {
          toast.warning("備份完成（部分資料表失敗）");
        } else {
          toast.success("備份完成");
        }
        router.refresh();
      } catch {
        toast.error("備份失敗，請稍後再試");
      }
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">備份清單</CardTitle>
        <Button onClick={handleBackup} disabled={backingUp} size="sm">
          {backingUp ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-4 w-4" />
          )}
          {backingUp ? "備份中…" : "立即備份"}
        </Button>
      </CardHeader>

      <CardContent>
        {backups.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            尚無備份紀錄
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
                    備份時間
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
                    狀態
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
                    資料表筆數摘要
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
                    目錄大小
                  </th>
                  <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => {
                  const isPartial = b.status === "partial";
                  const isUnknown = b.status === "unknown";
                  const disableRestore = isPartial || isUnknown;

                  return (
                    <tr
                      key={b.snapshotName}
                      className="border-b border-border last:border-0"
                    >
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatTimestamp(b.timestamp)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {b.status === "complete" && (
                          <Badge variant="default">完整</Badge>
                        )}
                        {b.status === "partial" && (
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            部分失敗
                          </Badge>
                        )}
                        {b.status === "unknown" && (
                          <Badge variant="secondary">未知</Badge>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {summarizeTableCounts(b.tables)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {formatBytes(b.sizeBytes)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={disableRestore}
                          onClick={() => setRestoreTarget(b.snapshotName)}
                          title={
                            disableRestore
                              ? "備份不完整，無法還原"
                              : "還原此備份"
                          }
                        >
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                          還原
                          {isPartial && (
                            <AlertTriangle className="ml-1 h-3 w-3 text-destructive" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {restoreTarget && (
        <RestorePreviewDialog
          open={!!restoreTarget}
          onOpenChange={(open) => {
            if (!open) {
              setRestoreTarget(null);
              router.refresh();
            }
          }}
          snapshotName={restoreTarget}
        />
      )}
    </Card>
  );
}
