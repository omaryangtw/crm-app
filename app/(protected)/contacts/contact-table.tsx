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
import { MoreHorizontal, Phone, Search } from "lucide-react";
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
import { ConfirmDialog } from "@/app/_components/confirm-dialog";
import { ExpandableText } from "@/app/_components/expandable-text";
import { CONTACT_TYPE_LABELS } from "@/app/_lib/constants/enums";
import { deleteContact } from "@/app/_lib/actions/contact-actions";
import { markContactUnsuccessful } from "@/app/_lib/actions/contact-actions";

interface ContactRow {
  id: number;
  date: Date | string | null;
  contactType: string | null;
  isSuccess: boolean;
  record: string | null;
  staffInCharge: { id: number; name: string }[];
  client: { id: number; name: string | null };
}

function ActionsCell({ row }: { row: ContactRow }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [markFailOpen, setMarkFailOpen] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [marking, startMark] = useTransition();

  const handleDelete = () => {
    startDelete(async () => {
      await deleteContact(row.id);
      setDeleteOpen(false);
      router.refresh();
    });
  };

  const handleMarkUnsuccessful = () => {
    startMark(async () => {
      const result = await markContactUnsuccessful(row.id);
      setMarkFailOpen(false);
      if (!result.success) {
        alert(result.error);
      }
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
            <Link href={`/contacts/${row.id}`} className="w-full">
              查看
            </Link>
          </DropdownMenuItem>
          {row.isSuccess && (
            <DropdownMenuItem onSelect={() => setMarkFailOpen(true)}>
              標記失敗
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            刪除
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="確認刪除"
        description="確定要刪除此通聯紀錄嗎？此操作無法復原。"
        confirmLabel="刪除"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleting}
      />

      <ConfirmDialog
        open={markFailOpen}
        onOpenChange={setMarkFailOpen}
        title="標記為失敗"
        description="確定要將此通聯紀錄標記為失敗嗎？"
        confirmLabel="確認"
        onConfirm={handleMarkUnsuccessful}
        loading={marking}
      />
    </>
  );
}

const CONTACT_TYPE_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  outgoing: "outline",
  incoming: "default",
  visit: "secondary",
  sms: "outline",
};

const columns: ColumnDef<ContactRow>[] = [
  {
    accessorKey: "date",
    header: "日期",
    cell: ({ row, getValue }) => {
      const v = getValue<Date | string | null>();
      const label = v
        ? (typeof v === "string" ? new Date(v) : v).toLocaleDateString("zh-TW")
        : "—";
      return (
        <Link
          href={`/contacts/${row.original.id}`}
          className="text-primary hover:underline"
        >
          {label}
        </Link>
      );
    },
  },
  {
    accessorKey: "contactType",
    header: "類型",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      if (!v) return "—";
      const label = CONTACT_TYPE_LABELS[v] ?? v;
      const variant = CONTACT_TYPE_BADGE_VARIANT[v] ?? "outline";
      return <Badge variant={variant}>{label}</Badge>;
    },
  },
  {
    accessorKey: "isSuccess",
    header: "成功",
    cell: ({ getValue }) => (getValue<boolean>() ? "✓" : "✗"),
  },
  {
    accessorKey: "record",
    header: "紀錄",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      if (!v) return "—";
      return <ExpandableText text={v} />;
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

interface ContactTableProps {
  contacts: ContactRow[];
  searchQuery?: string;
  pagination?: { page: number; pageSize: number; total: number };
}

export function ContactTable({ contacts, searchQuery, pagination }: ContactTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: contacts,
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
        icon: <Phone />,
        title: "尚無通聯紀錄",
        description: "點擊下方按鈕新增第一筆通聯紀錄",
        action: { label: "新增通聯", href: "/contacts/new" },
      };

  return (
    <div className="space-y-4">
      <SearchInput placeholder="搜尋通聯紀錄…" />
      <DataTable
        table={table}
        columns={columns}
        emptyState={emptyState}
        pagination={pagination}
      />
    </div>
  );
}
