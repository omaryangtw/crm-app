"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import type { BirthdayClientRow } from "./page";

const MONTH_OPTIONS = [
  { value: 0, label: "全部月份" },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: `${i + 1} 月`,
  })),
];

interface BirthdayTableProps {
  clients: BirthdayClientRow[];
}

export function BirthdayTable({ clients }: BirthdayTableProps) {
  const [month, setMonth] = useState(0);

  const filtered = useMemo(() => {
    if (month === 0) return clients;
    return clients.filter((c) => c.birthMonth === month);
  }, [clients, month]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label htmlFor="month-filter" className="text-sm font-medium text-foreground">
          月份篩選
        </label>
        <select
          id="month-filter"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
          className="rounded-md border border-input px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        >
          {MONTH_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">
          共 {filtered.length} 筆
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              {["姓名", "生日", "年齡", "電話", "手機", "區域", "里", "地址", "可寄件"].map(
                (header) => (
                  <th
                    key={header}
                    className="px-4 py-3 text-left font-medium text-muted-foreground"
                  >
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                  無資料
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/clients/${c.id}`}
                      className="text-primary hover:underline"
                    >
                      {c.name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {format(new Date(c.birthday), "yyyy-MM-dd")}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.age ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.mobile ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.dist ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.vill ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.addr ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {c.canMail ? "是" : "否"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
