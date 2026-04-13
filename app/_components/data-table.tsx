"use client";

import Link from "next/link";
import {
  type ColumnDef,
  flexRender,
  type Table as TanStackTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EmptyState } from "./empty-state";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DataTableProps<TData> {
  table: TanStackTable<TData>;
  columns: ColumnDef<TData, unknown>[];
  /** Empty state when no data */
  emptyState?: {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: { label: string; href: string };
  };
  /** Pagination info */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export function DataTable<TData>({
  table,
  columns,
  emptyState,
  pagination,
}: DataTableProps<TData>) {
  const rows = table.getRowModel().rows;
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <TableHead
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={canSort ? "cursor-pointer select-none" : ""}
                    >
                      <span className="inline-flex items-center gap-1">
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {sorted === "asc" && " ↑"}
                        {sorted === "desc" && " ↓"}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-48">
                  {emptyState ? (
                    <EmptyState
                      icon={emptyState.icon}
                      title={emptyState.title}
                      description={emptyState.description}
                      action={emptyState.action}
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      無資料
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/50">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            顯示{" "}
            {Math.min(
              (pagination.page - 1) * pagination.pageSize + 1,
              pagination.total
            )}
            -{Math.min(pagination.page * pagination.pageSize, pagination.total)}{" "}
            筆，共 {pagination.total} 筆
          </span>
          <div className="flex items-center gap-2">
            {pagination.page > 1 ? (
              <Link href={`?page=${pagination.page - 1}`}>
                <Button variant="outline" size="icon-sm">
                  <ChevronLeft className="size-4" />
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="icon-sm" disabled>
                <ChevronLeft className="size-4" />
              </Button>
            )}
            <span className="text-foreground">
              {pagination.page} / {totalPages}
            </span>
            {pagination.page < totalPages ? (
              <Link href={`?page=${pagination.page + 1}`}>
                <Button variant="outline" size="icon-sm">
                  <ChevronRight className="size-4" />
                </Button>
              </Link>
            ) : (
              <Button variant="outline" size="icon-sm" disabled>
                <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
