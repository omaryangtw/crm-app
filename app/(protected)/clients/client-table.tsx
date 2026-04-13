"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { SEX_LABELS, PLAIN_MOUNTAIN_LABELS } from "@/app/_lib/constants/enums";

// Minimal Client type matching the Prisma model fields we display
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

const columns: ColumnDef<ClientRow>[] = [
  {
    accessorKey: "name",
    header: "姓名",
    cell: ({ row }) => (
      <Link
        href={`/clients/${row.original.id}`}
        className="text-blue-600 hover:underline"
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
];

interface ClientTableProps {
  clients: ClientRow[];
}

export function ClientTable({ clients }: ClientTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  // Debounced URL param update
  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (search) {
          params.set("q", search);
        } else {
          params.delete("q");
        }
        router.replace(`/clients?${params.toString()}`);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, router, searchParams, startTransition]);

  const table = useReactTable({
    data: clients,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜尋族人（姓名、電話、地址…）"
        className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left font-medium text-gray-600 select-none"
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ cursor: header.column.getCanSort() ? "pointer" : "default" }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  無資料
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
