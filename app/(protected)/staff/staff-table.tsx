"use client";

import { useState } from "react";
import Link from "next/link";
import {
  type ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { MoreHorizontal, UserCog, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/app/_components/data-table";
import { SearchInput } from "@/app/_components/search-input";

interface StaffRow {
  id: number;
  name: string;
  aliases: string[];
  email: string | null;
  phone: string | null;
  isActive: boolean;
}

function ActionsCell({ row }: { row: StaffRow }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <MoreHorizontal className="size-4" />
        <span className="sr-only">操作選單</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>
          <Link href={`/staff/${row.id}`} className="w-full">
            查看
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link href={`/staff/${row.id}/edit`} className="w-full">
            編輯
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const columns: ColumnDef<StaffRow>[] = [
  {
    accessorKey: "name",
    header: "姓名",
    cell: ({ row }) => (
      <Link
        href={`/staff/${row.original.id}`}
        className="text-primary hover:underline"
      >
        {row.original.name}
      </Link>
    ),
  },
  {
    accessorKey: "email",
    header: "電子郵件",
    cell: ({ getValue }) => getValue<string | null>() ?? "—",
  },
  {
    accessorKey: "phone",
    header: "電話",
    cell: ({ getValue }) => getValue<string | null>() ?? "—",
  },
  {
    accessorKey: "isActive",
    header: "狀態",
    enableSorting: false,
    cell: ({ getValue }) => {
      const active = getValue<boolean>();
      return (
        <Badge variant={active ? "default" : "secondary"}>
          {active ? "啟用" : "停用"}
        </Badge>
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

interface StaffTableProps {
  staff: StaffRow[];
  searchQuery?: string;
}

export function StaffTable({ staff, searchQuery }: StaffTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data: staff,
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
        icon: <UserCog />,
        title: "尚無員工資料",
        description: "點擊下方按鈕新增第一筆員工",
        action: { label: "新增員工", href: "/staff/new" },
      };

  return (
    <div className="space-y-4">
      <SearchInput placeholder="搜尋員工（姓名、電子郵件、電話）" />
      <DataTable
        table={table}
        columns={columns}
        emptyState={emptyState}
      />
    </div>
  );
}
