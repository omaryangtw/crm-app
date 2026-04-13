"use client";

import { useEffect, useRef, useState } from "react";
import { getActiveStaff } from "@/app/_lib/actions/staff-actions";

interface StaffSelectorProps {
  /** Form field name, e.g. "staffInChargeIds" */
  name: string;
  /** Pre-selected staff IDs for edit forms */
  defaultValue?: number[];
}

const btnClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm text-left outline-none focus:ring-2 focus:ring-ring";

export default function StaffSelector({ name, defaultValue = [] }: StaffSelectorProps) {
  const [staffList, setStaffList] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>(defaultValue);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getActiveStaff()
      .then(setStaffList)
      .finally(() => setLoading(false));
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleId(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const selectedNames = staffList
    .filter((s) => selectedIds.includes(s.id))
    .map((s) => s.name);

  const displayText =
    selectedNames.length === 0
      ? "請選擇承辦人"
      : selectedNames.join(", ");

  return (
    <div ref={wrapperRef} className="relative">
      <label className="mb-1 block text-sm font-medium">承辦人</label>
      {/* Hidden input carries the comma-separated IDs for FormData */}
      <input type="hidden" name={name} value={selectedIds.join(",")} />
      <button
        type="button"
        className={btnClass}
        onClick={() => setOpen((prev) => !prev)}
        disabled={loading}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="block truncate">{loading ? "載入中..." : displayText}</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-white shadow-lg text-sm"
        >
          {staffList.length === 0 && (
            <li className="px-3 py-2 text-gray-400">無可用承辦人</li>
          )}
          {staffList.map((s) => {
            const checked = selectedIds.includes(s.id);
            return (
              <li
                key={s.id}
                role="option"
                aria-selected={checked}
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-100"
                onClick={() => toggleId(s.id)}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="rounded border-gray-300"
                  tabIndex={-1}
                />
                <span>{s.name}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
