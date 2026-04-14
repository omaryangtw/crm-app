"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DeletionRequestStatus } from "@prisma/client";
import { DataTable } from "@/app/_components/data-table";
import { ConfirmDialog } from "@/app/_components/confirm-dialog";
import {
  approveDeletion,
  rejectDeletion,
  restoreDeletion,
} from "@/app/_lib/actions/deletion-actions";
import type { DeletionRequestWithLabel } from "@/app/_lib/actions/deletion-actions";

/* ── Label maps ── */

const ENTITY_TYPE_LABELS: Record<string, string> = {
  Client: "族人",
  Case: "案件",
  Contact: "通聯紀錄",
};

const CASCADE_TYPE_LABELS: Record<string, string> = {
  Case: "案件",
  Contact: "通聯紀錄",
  Todo: "待辦事項",
  FamilyRelation: "家庭關係",
  ClientPhoto: "照片",
};

const STATUS_LABELS: Record<DeletionRequestStatus, string> = {
  pending: "待審核",
  approved: "已核准",
  rejected: "已駁回",
  restored: "已還原",
};

const STATUS_BADGE_VARIANT: Record<DeletionRequestStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "default",
  approved: "destructive",
  rejected: "secondary",
  restored: "outline",
};

/* ── Status filter tabs ── */

const STATUS_TABS: { label: string; value: DeletionRequestStatus | undefined }[] = [
  { label: "全部", value: undefined },
  { label: "待審核", value: "pending" },
  { label: "已核准", value: "approved" },
  { label: "已駁回", value: "rejected" },
  { label: "已還原", value: "restored" },
];

/* ── Confirm dialog types ── */

type DialogAction = "approve" | "reject" | "restore";

const DIALOG_CONFIG: Record<DialogAction, {
  title: string;
  description: string;
  confirmLabel: string;
  variant: "default" | "destructive";
}> = {
  approve: {
    title: "確認核准刪除",
    description: "核准後將刪除該筆資料，確定要核准此刪除申請嗎？",
    confirmLabel: "核准",
    variant: "destructive",
  },
  reject: {
    title: "確認駁回刪除",
    description: "駁回後該筆資料將保留不變，確定要駁回此刪除申請嗎？",
    confirmLabel: "駁回",
    variant: "default",
  },
  restore: {
    title: "確認還原資料",
    description: "將從快照還原已刪除的資料，確定要還原嗎？",
    confirmLabel: "還原",
    variant: "default",
  },
};

/* ── Actions cell ── */

function ActionsCell({ row }: { row: DeletionRequestWithLabel }) {
  const router = useRouter();
  const [dialogAction, setDialogAction] = useState<DialogAction | null>(null);
  const [loading, startTransition] = useTransition();

  const handleConfirm = () => {
    if (!dialogAction) return;
    startTransition(async () => {
      switch (dialogAction) {
        case "approve":
          await approveDeletion(row.id);
          break;
        case "reject":
          await rejectDeletion(row.id);
          break;
        case "restore":
          await restoreDeletion(row.id);
          break;
      }
      setDialogAction(null);
      router.refresh();
    });
  };

  const config = dialogAction ? DIALOG_CONFIG[dialogAction] : null;

  return (
    <>
      <div className="flex items-center gap-2">
        {row.status === "pending" && (
          <>
            <Button
              size="sm"
              variant="default"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setDialogAction("approve")}
            >
              核准
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDialogAction("reject")}
            >
              駁回
            </Button>
          </>
        )}
        {row.status === "approved" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDialogAction("restore")}
          >
            還原
          </Button>
        )}
      </div>

      {config && (
        <ConfirmDialog
          open={dialogAction !== null}
          onOpenChange={(open) => {
            if (!open) setDialogAction(null);
          }}
          title={config.title}
          description={config.description}
          confirmLabel={config.confirmLabel}
          variant={config.variant}
          onConfirm={handleConfirm}
          loading={loading}
        />
      )}
    </>
  );
}

/* ── Column definitions ── */

const columns: ColumnDef<DeletionRequestWithLabel>[] = [
  {
    accessorKey: "entityType",
    header: "資料類型",
    cell: ({ getValue }) => {
      const v = getValue<string>();
      return ENTITY_TYPE_LABELS[v] ?? v;
    },
  },
  {
    accessorKey: "entityId",
    header: "資料 ID",
  },
  {
    accessorKey: "entityLabel",
    header: "資料名稱",
  },
  {
    accessorKey: "cascadeSelection",
    header: "一併刪除",
    enableSorting: false,
    cell: ({ row }) => {
      const selection = row.original.cascadeSelection;
      if (!Array.isArray(selection) || selection.length === 0) return "—";
      return (
        <div className="flex flex-wrap gap-1">
          {(selection as string[]).map((type) => (
            <Badge key={type} variant="outline" className="text-xs">
              {CASCADE_TYPE_LABELS[type] ?? type}
            </Badge>
          ))}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "狀態",
    cell: ({ getValue }) => {
      const v = getValue<DeletionRequestStatus>();
      return (
        <Badge variant={STATUS_BADGE_VARIANT[v] ?? "outline"}>
          {STATUS_LABELS[v] ?? v}
        </Badge>
      );
    },
  },
  {
    accessorKey: "requesterEmail",
    header: "申請人",
  },
  {
    accessorKey: "createdAt",
    header: "申請時間",
    cell: ({ getValue }) => {
      const v = getValue<Date | string>();
      if (!v) return "—";
      const d = typeof v === "string" ? new Date(v) : v;
      return d.toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
  },
  {
    id: "actions",
    header: "操作",
    enableSorting: false,
    cell: ({ row }) => <ActionsCell row={row.original} />,
  },
];

/* ── Main component ── */

interface DeletionRequestTableProps {
  requests: DeletionRequestWithLabel[];
  total: number;
  currentStatus?: DeletionRequestStatus;
}

export function DeletionRequestTable({
  requests,
  total,
  currentStatus,
}: DeletionRequestTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: requests,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const isActive = currentStatus === tab.value;
          const href = tab.value
            ? `?status=${tab.value}`
            : "/admin/deletion-requests";
          return (
            <Link key={tab.label} href={href}>
              <Button
                variant={isActive ? "default" : "outline"}
                size="sm"
              >
                {tab.label}
              </Button>
            </Link>
          );
        })}
      </div>

      <DataTable
        table={table}
        columns={columns}
        emptyState={{
          icon: <ClipboardList />,
          title: "目前沒有刪除申請",
          description: currentStatus
            ? `沒有${STATUS_LABELS[currentStatus]}的刪除申請`
            : undefined,
        }}
      />
    </div>
  );
}
