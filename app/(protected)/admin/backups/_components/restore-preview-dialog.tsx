"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  RestorePreview,
  TableRestorePreview,
  ConflictRecord,
  ConflictResolution,
  RestoreApplyResult,
} from "@/app/_lib/utils/restore";

interface RestorePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshotName: string;
}

type Phase = "loading" | "preview" | "applying" | "done" | "error";

export function RestorePreviewDialog({
  open,
  onOpenChange,
  snapshotName,
}: RestorePreviewDialogProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [resolutions, setResolutions] = useState<Map<string, ConflictResolution>>(new Map());
  const [result, setResult] = useState<RestoreApplyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Collect all conflicts across tables
  const allConflicts: ConflictRecord[] =
    preview?.tables.flatMap((t) => t.conflicts) ?? [];
  const totalConflicts = allConflicts.length;
  const resolvedCount = resolutions.size;
  const allResolved = totalConflicts > 0 ? resolvedCount === totalConflicts : true;
  const hasConflicts = totalConflicts > 0;

  // Fetch preview on open
  useEffect(() => {
    if (!open) return;
    setPhase("loading");
    setPreview(null);
    setResolutions(new Map());
    setResult(null);
    setErrorMsg("");

    fetch("/api/backup/restore/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshotName }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "預覽失敗");
        }
        return res.json();
      })
      .then((data: RestorePreview) => {
        setPreview(data);
        setPhase("preview");
      })
      .catch((err: Error) => {
        setErrorMsg(err.message);
        setPhase("error");
      });
  }, [open, snapshotName]);

  // --- Resolution helpers ---

  const setResolution = useCallback(
    (tableName: string, recordId: number | string, choice: "backup" | "current") => {
      setResolutions((prev) => {
        const next = new Map(prev);
        next.set(`${tableName}:${recordId}`, { tableName, recordId, choice });
        return next;
      });
    },
    []
  );

  const batchResolve = useCallback(
    (choice: "backup" | "current") => {
      setResolutions(() => {
        const next = new Map<string, ConflictResolution>();
        for (const c of allConflicts) {
          next.set(`${c.tableName}:${c.id}`, {
            tableName: c.tableName,
            recordId: c.id,
            choice,
          });
        }
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [preview]
  );

  // --- Apply ---

  const handleApply = async () => {
    setPhase("applying");
    try {
      const res = await fetch("/api/backup/restore/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotName,
          conflictResolutions: Array.from(resolutions.values()),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "套用失敗");
      }
      const data: RestoreApplyResult = await res.json();
      setResult(data);
      setPhase("done");
      toast.success("還原完成");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "套用失敗";
      setErrorMsg(msg);
      setPhase("error");
      toast.error(msg);
    }
  };

  // --- Render ---

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>還原預覽</DialogTitle>
          <DialogDescription>
            備份快照：{snapshotName}
          </DialogDescription>
        </DialogHeader>

        {/* Loading */}
        {phase === "loading" && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              正在比對資料…
            </span>
          </div>
        )}

        {/* Error */}
        {phase === "error" && (
          <div className="flex flex-col items-center gap-3 py-12">
            <XCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{errorMsg}</p>
          </div>
        )}

        {/* Preview */}
        {phase === "preview" && preview && (
          <div className="space-y-6">
            {/* Summary table */}
            <SummaryTable tables={preview.tables} />

            {/* Conflict resolution */}
            {hasConflicts && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    衝突記錄（{resolvedCount}/{totalConflicts} 已解決）
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => batchResolve("backup")}
                    >
                      全部使用備份版本
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => batchResolve("current")}
                    >
                      全部保留現有版本
                    </Button>
                  </div>
                </div>

                {preview.tables
                  .filter((t) => t.conflicts.length > 0)
                  .map((t) => (
                    <ConflictSection
                      key={t.tableName}
                      table={t}
                      resolutions={resolutions}
                      onResolve={setResolution}
                    />
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Applying */}
        {phase === "applying" && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              正在套用還原…
            </span>
          </div>
        )}

        {/* Done */}
        {phase === "done" && result && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">還原完成</span>
            </div>
            <ResultTable tables={result.tables} />
          </div>
        )}

        {/* Footer */}
        {phase === "preview" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button
              onClick={handleApply}
              disabled={!allResolved}
              title={
                !allResolved
                  ? "請先解決所有衝突記錄"
                  : "確認套用還原"
              }
            >
              確認套用
            </Button>
          </DialogFooter>
        )}

        {phase === "done" && (
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>關閉</Button>
          </DialogFooter>
        )}

        {phase === "error" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              關閉
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Summary Table ── */

function SummaryTable({ tables }: { tables: TableRestorePreview[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
              資料表
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
              相同
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
              新增
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
              衝突
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
              已刪除
            </th>
          </tr>
        </thead>
        <tbody>
          {tables.map((t) => (
            <tr
              key={t.tableName}
              className="border-b border-border last:border-0"
            >
              <td className="whitespace-nowrap px-3 py-2 font-medium">
                {t.tableName}
              </td>
              <td className="whitespace-nowrap px-3 py-2">{t.identical}</td>
              <td className="whitespace-nowrap px-3 py-2">
                {t.newRecords.length > 0 ? (
                  <Badge variant="default">{t.newRecords.length}</Badge>
                ) : (
                  "0"
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {t.conflicts.length > 0 ? (
                  <Badge variant="destructive">
                    <AlertTriangle className="mr-0.5 h-3 w-3" />
                    {t.conflicts.length}
                  </Badge>
                ) : (
                  "0"
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {t.deleted.length > 0 ? (
                  <Badge variant="secondary">{t.deleted.length}</Badge>
                ) : (
                  "0"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Conflict Section per table ── */

function ConflictSection({
  table,
  resolutions,
  onResolve,
}: {
  table: TableRestorePreview;
  resolutions: Map<string, ConflictResolution>;
  onResolve: (
    tableName: string,
    recordId: number | string,
    choice: "backup" | "current"
  ) => void;
}) {
  return (
    <div className="rounded-lg border border-border">
      <div className="px-3 py-2 bg-muted/50 border-b border-border">
        <span className="text-sm font-medium">{table.tableName}</span>
        <Badge variant="destructive" className="ml-2">
          {table.conflicts.length} 筆衝突
        </Badge>
      </div>
      <div className="divide-y divide-border">
        {table.conflicts.map((conflict) => {
          const key = `${conflict.tableName}:${conflict.id}`;
          const current = resolutions.get(key);
          return (
            <ConflictItem
              key={key}
              conflict={conflict}
              choice={current?.choice ?? null}
              onResolve={onResolve}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ── Single Conflict Item ── */

function ConflictItem({
  conflict,
  choice,
  onResolve,
}: {
  conflict: ConflictRecord;
  choice: "backup" | "current" | null;
  onResolve: (
    tableName: string,
    recordId: number | string,
    choice: "backup" | "current"
  ) => void;
}) {
  return (
    <div className="p-3 space-y-3">
      {/* Record ID & timestamps */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          ID: {String(conflict.id)}
        </span>
        <div className="flex gap-4 text-xs text-muted-foreground">
          {conflict.backupUpdatedAt && (
            <span>備份更新：{formatTs(conflict.backupUpdatedAt)}</span>
          )}
          {conflict.currentUpdatedAt && (
            <span>現有更新：{formatTs(conflict.currentUpdatedAt)}</span>
          )}
        </div>
      </div>

      {/* Side-by-side diff */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-md border border-border p-2 space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            備份版本
          </p>
          {conflict.diffFields.map((field) => (
            <div
              key={field}
              className="rounded px-2 py-0.5 text-xs bg-accent"
            >
              <span className="font-medium">{field}:</span>{" "}
              {formatValue(conflict.backupData[field])}
            </div>
          ))}
        </div>
        <div className="rounded-md border border-border p-2 space-y-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            現有版本
          </p>
          {conflict.diffFields.map((field) => (
            <div
              key={field}
              className="rounded px-2 py-0.5 text-xs bg-destructive/10"
            >
              <span className="font-medium">{field}:</span>{" "}
              {formatValue(conflict.currentData[field])}
            </div>
          ))}
        </div>
      </div>

      {/* Resolution radio buttons */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={choice === "backup" ? "default" : "outline"}
          onClick={() => onResolve(conflict.tableName, conflict.id, "backup")}
        >
          使用備份版本
        </Button>
        <Button
          size="sm"
          variant={choice === "current" ? "default" : "outline"}
          onClick={() => onResolve(conflict.tableName, conflict.id, "current")}
        >
          保留現有版本
        </Button>
      </div>
    </div>
  );
}

/* ── Result Table ── */

function ResultTable({
  tables,
}: {
  tables: RestoreApplyResult["tables"];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
              資料表
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
              相同
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
              新增
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
              衝突已解決
            </th>
            <th className="whitespace-nowrap px-3 py-2 font-medium text-muted-foreground">
              已刪除
            </th>
          </tr>
        </thead>
        <tbody>
          {tables.map((t) => (
            <tr
              key={t.tableName}
              className="border-b border-border last:border-0"
            >
              <td className="whitespace-nowrap px-3 py-2 font-medium">
                {t.tableName}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {t.identicalCount}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {t.insertedCount}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {t.conflictResolvedCount}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {t.deletedCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Helpers ── */

function formatTs(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  return d.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
}
