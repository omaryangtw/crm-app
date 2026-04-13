"use client";

import { useEffect, useState } from "react";
import { getActiveStaff } from "@/app/_lib/actions/staff-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, X } from "lucide-react";

interface StaffSelectorProps {
  /** Form field name, e.g. "staffInChargeIds" */
  name: string;
  /** Pre-selected staff IDs for edit forms */
  defaultValue?: number[];
}

export default function StaffSelector({
  name,
  defaultValue = [],
}: StaffSelectorProps) {
  const [staffList, setStaffList] = useState<
    { id: number; name: string; aliases: string[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>(defaultValue);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getActiveStaff()
      .then(setStaffList)
      .finally(() => setLoading(false));
  }, []);

  function toggleId(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function removeId(id: number) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  }

  const selectedStaff = staffList.filter((s) => selectedIds.includes(s.id));

  return (
    <div className="space-y-1">
      <label className="mb-1 block text-sm font-medium">承辦人</label>
      <input type="hidden" name={name} value={selectedIds.join(",")} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal h-auto min-h-9"
              disabled={loading}
            />
          }
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {loading && (
              <span className="text-muted-foreground">載入中...</span>
            )}
            {!loading && selectedStaff.length === 0 && (
              <span className="text-muted-foreground">選擇承辦人...</span>
            )}
            {selectedStaff.map((s) => (
              <Badge
                key={s.id}
                variant="secondary"
                className="gap-1"
              >
                {s.name}
                <button
                  type="button"
                  className="rounded-full outline-none hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeId(s.id);
                  }}
                  aria-label={`移除 ${s.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder="搜尋承辦人..." />
            <CommandList>
              <CommandEmpty>無可用承辦人</CommandEmpty>
              <CommandGroup>
                {staffList.map((s) => {
                  const checked = selectedIds.includes(s.id);
                  return (
                    <CommandItem
                      key={s.id}
                      value={s.name}
                      onSelect={() => toggleId(s.id)}
                      data-checked={checked}
                    >
                      <span className="mr-2">{checked ? "☑" : "☐"}</span>
                      {s.name}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
