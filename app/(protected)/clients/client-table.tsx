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
import { MoreHorizontal, Users, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { SEX_LABELS, PLAIN_MOUNTAIN_LABELS } from "@/app/_lib/constants/enums";
import { deleteClient } from "@/app/_lib/actions/client-actions";
import type { CascadeEntityType } from "@/app/_lib/utils/snapshot-builder";

interface ClientRow {
  id: number;
  name: string | null;
  sex: string | null;
  phone: string | null;
  mobile: string | null;
  dist: string | null;
  addr: string | null;
  plainMountain: string | null;
}

function ActionsCell({ row }: { row: ClientRow }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, startDelete] = useTransition();

  const handleDelete = (cascadeSelection: CascadeEntityType[]) => {
    startDelete(async () => {
      await deleteClient(row.id, cascadeSelection);
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
            <Link href={`/clients/${row.id}`} className="w-full">
              查看
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Link href={`/clients/${row.id}/edit`} className="w-full">
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
        entityType="Client"
        entityId={row.id}
        entityLabel={row.name ?? "此族人"}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  );
}

const columns: ColumnDef<ClientRow>[] = [
  {
    accessorKey: "name",
    header: "姓名",
    cell: ({ row }) => (
      <Link
        href={`/clients/${row.original.id}`}
        className="text-primary hover:underline"
      >
        {row.original.name ?? "—"}
      </Link>
    ),
  },
  {
    accessorKey: "sex",
    header: "性別",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      return v ? (SEX_LABELS[v] ?? v) : "—";
    },
  },
  {
    id: "phone",
    header: "電話",
    accessorFn: (row) => row.phone || row.mobile || null,
    cell: ({ row }) => row.original.phone || row.original.mobile || "—",
  },
  {
    accessorKey: "dist",
    header: "區域",
    cell: ({ getValue }) => getValue<string | null>() ?? "—",
  },
  {
    accessorKey: "addr",
    header: "地址",
    cell: ({ getValue }) => getValue<string | null>() ?? "—",
  },
  {
    accessorKey: "plainMountain",
    header: "平原/山原",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      return v ? (PLAIN_MOUNTAIN_LABELS[v] ?? v) : "—";
    },
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    cell: ({ row }) => <ActionsCell row={row.original} />,
  },
];

interface ClientTableProps {
  clients: ClientRow[];
  searchQuery?: string;
  pagination?: { page: number; pageSize: number; total: number };
}

export function ClientTable({ clients, searchQuery, pagination }: ClientTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: clients,
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
        icon: <Users />,
        title: "尚無族人資料",
        description: "點擊下方按鈕新增第一筆族人",
        action: { label: "新增族人", href: "/clients/new" },
      };

  return (
    <div className="space-y-4">
      <SearchInput placeholder="搜尋族人（姓名、電話、地址…）" />
      <DataTable
        table={table}
        columns={columns}
        emptyState={emptyState}
        pagination={pagination}
      />
    </div>
  );
}
