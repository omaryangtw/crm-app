"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_MAJOR_LABELS,
} from "@/app/_lib/constants/enums";

interface CaseRow {
  id: number;
  name: string | null;
  status: string | null;
  typesMajor: string | null;
  staffInCharge: { id: number; name: string }[];
  client: { id: number; name: string | null };
}

const columns: ColumnDef<CaseRow>[] = [
  {
    accessorKey: "name",
    header: "案件名稱",
    cell: ({ getValue }) => getValue<string | null>() ?? "—",
  },
  {
    accessorKey: "status",
    header: "狀態",
    cell: ({ getValue }) => {
      const v = getValue<string | null>();
      return v ? (CASE_STATUS_LABELS[v] ?? v) : "—";
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
          className="text-blue-600 hover:underline"
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
    header: "操作",
    enableSorting: false,
    cell: ({ row }) => (
      <Link
        href={`/cases/${row.original.id}`}
        className="text-blue-600 hover:underline text-sm"
      >
        查看
      </Link>
    ),
  },
];

interface CaseTableProps {
  cases: CaseRow[];
}

export function CaseTable({ cases }: CaseTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [showClosed, setShowClosed] = useState(true);

  // Debounced URL param update for search
  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (search) {
          params.set("q", search);
        } else {
          params.delete("q");
        }
        router.replace(`/cases?${params.toString()}`);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, router, searchParams, startTransition]);

  // Filter closed cases client-side
  const filteredCases = showClosed
    ? cases
    : cases.filter((c) => c.status !== "closed");

  const table = useReactTable({
    data: filteredCases,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋案件（名稱、備註、處理方式…）"
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <label className="inline-flex items-center gap-2 text-sm text-gray-600 select-none">
          <input
            type="checkbox"
            checked={showClosed}
            onChange={(e) => setShowClosed(e.target.checked)}
            className="rounded border-gray-300"
          />
          顯示已結案
        </label>
      </div>

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
                    style={{
                      cursor: header.column.getCanSort()
                        ? "pointer"
                        : "default",
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {{
                        asc: " ↑",
                        desc: " ↓",
                      }[header.column.getIsSorted() as string] ?? ""}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-400"
                >
                  無資料
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 whitespace-nowrap"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
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
