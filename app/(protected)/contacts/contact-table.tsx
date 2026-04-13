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
import { CONTACT_TYPE_LABELS } from "@/app/_lib/constants/enums";
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

interface ContactTableProps {
  contacts: ContactRow[];
}

export function ContactTable({ contacts }: ContactTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());

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
        router.replace(`/contacts?${params.toString()}`);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, router, searchParams, startTransition]);

  async function handleMarkUnsuccessful(id: number) {
    setPendingIds((prev) => new Set(prev).add(id));
    try {
      const result = await markContactUnsuccessful(id);
      if (!result.success) {
        alert(result.error);
      }
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

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
            className="text-blue-600 hover:underline"
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
        return v ? (CONTACT_TYPE_LABELS[v] ?? v) : "—";
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
        return v.length > 40 ? `${v.slice(0, 40)}…` : v;
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
      cell: ({ row }) => {
        const contact = row.original;
        if (!contact.isSuccess) return null;
        const isPending = pendingIds.has(contact.id);
        return (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleMarkUnsuccessful(contact.id)}
            className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
          >
            {isPending ? "處理中…" : "標記失敗"}
          </button>
        );
      },
    },
  ];

  const table = useReactTable({
    data: contacts,
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
        placeholder="搜尋通聯紀錄…"
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
