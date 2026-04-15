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
import { MoreHorizontal, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/app/_components/data-table";
import { SearchInput } from "@/app/_components/search-input";
import { DeleteRequestDialog } from "@/app/_components/delete-request-dialog";
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_MAJOR_LABELS,
} from "@/app/_lib/constants/enums";
import { deleteCase } from "@/app/_lib/actions/case-actions";

interface CaseRow {
  id: number;
  name: string | null;
  status: string | null;
  typesMajor: string | null;
  staffInCharge: { id: number; name: string }[];
  client: { id: number; name: string | null };
}

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary"> = {
  in_progress: "default",
  closed: "secondary",
};

function ActionsCell({ row }: { row: CaseRow }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, startDelete] = useTransition();

  const handleDelete = () => {
    startDelete(async () => {
      await deleteCase(row.id);
      setDeleteOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
          <MoreHorizontal className="size-4" />
          <span className="sr-only">操作選單</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Link href={`/cases/${row.id}`} className="w-full">
              查看
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link href={`/cases/${row.id}/edit`} className="w-full">
              編輯
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            刪除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteRequestDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        entityType="Case"
        entityId={row.id}
        entityLabel={row.name ?? "此案件"}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  );
}

const columns: ColumnDef<CaseRow>[] = [
  {
    accessorKey: "name",
    header: "案件名稱",
    cell: ({ row }) => (
      <Link
        href={`/cases/${row.original.id}`}
        className="text-primary hover:underline"
      >
        {row.original.name ?? "—"}
      </Link>
    ),
  },
  {
    accessorKey: "status",
    header: "狀態",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      if (!v) return "—";
      const label = CASE_STATUS_LABELS[v] ?? v;
      const variant = STATUS_BADGE_VARIANT[v] ?? "outline";
      return <Badge variant={variant}>{label}</Badge>;
    },
  },
  {
    accessorKey: "typesMajor",
    header: "類型",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      return v ? (CASE_TYPE_MAJOR_LABELS[v] ?? v) : "—";
    },
  },
  {
    id: "staffInCharge",
    header: "承辦人",
    accessorFn: (row) => row.staffInCharge.map((s) => s.name).join(", ") || null,
    cell: ({ getValue }) => getValue<string | null>() ?? "—",
  },
  {
    id: "clientName",
    header: "族人",
    accessorFn: (row) => row.client?.name ?? null,
    cell: ({ row }) => {
      const client = row.original.client;
      return client ? (
        <Link
          href={`/clients/${client.id}`}
          className="text-primary hover:underline"
        >
          {client.name ?? "—"}
        </Link>
      ) : (
        "—"
      );
    },
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => <ActionsCell row={row.original} />,
  },
];

interface CaseTableProps {
  cases: CaseRow[];
  searchQuery?: string;
  pagination?: { page: number; pageSize: number; total: number };
}

export function CaseTable({ cases, searchQuery, pagination }: CaseTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: cases,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const emptyState = searchQuery
    ? {
        icon: <Search />,
        title: `找不到符合「${searchQuery}」的結果`,
        description: "請嘗試其他關鍵字",
      }
    : {
        icon: <FileText />,
        title: "尚無案件資料",
        description: "點擊下方按鈕新增第一筆案件",
        action: { label: "新增案件", href: "/cases/new" },
      };

  return (
    <div className="space-y-4">
      <SearchInput placeholder="搜尋案件（名稱、備註、處理方式…）" />
      <DataTable
        table={table}
        columns={columns}
        emptyState={emptyState}
        pagination={pagination}
      />
    </div>
  );
}
