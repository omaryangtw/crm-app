"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type {
  FilterConfig,
  FilterFieldConfig,
  ActiveFilter,
} from "@/app/_lib/filters/filter-config";
import { resolveFilterLabel } from "@/app/_lib/filters/filter-url";
import { loadStaffOptions } from "@/app/_lib/filters/relation-loaders";

// ---------------------------------------------------------------------------
// Relation loader registry — maps field name to its async loader
// ---------------------------------------------------------------------------

const RELATION_LOADERS: Record<
  string,
  () => Promise<{ id: string; label: string }[]>
> = {
  staffInCharge: loadStaffOptions,
};

// ---------------------------------------------------------------------------
// FilterBar
// ---------------------------------------------------------------------------

export interface FilterBarProps {
  config: FilterConfig;
  activeFilters: ActiveFilter[];
  /** Map of relation filter value → display label (resolved on server) */
  relationLabels?: Record<string, string>;
}

export function FilterBar({ config, activeFilters, relationLabels }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [popoverOpen, setPopoverOpen] = useState(false);

  /** Replace all f_ params in the URL with the given filters, reset page. */
  const updateFilters = useCallback(
    (newFilters: ActiveFilter[]) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const key of [...params.keys()]) {
        if (key.startsWith("f_")) params.delete(key);
      }
      for (const f of newFilters) {
        params.set(`f_${f.field}`, f.value);
      }
      params.delete("page");
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const removeFilter = useCallback(
    (field: string) => {
      updateFilters(activeFilters.filter((f) => f.field !== field));
    },
    [activeFilters, updateFilters],
  );

  const clearAll = useCallback(() => {
    updateFilters([]);
  }, [updateFilters]);

  const addFilter = useCallback(
    (field: string, value: string) => {
      const without = activeFilters.filter((f) => f.field !== field);
      updateFilters([...without, { field, value }]);
      setPopoverOpen(false);
    },
    [activeFilters, updateFilters],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {activeFilters.map((filter) => (
        <FilterChip
          key={filter.field}
          filter={filter}
          config={config}
          relationLabels={relationLabels}
          onRemove={() => removeFilter(filter.field)}
        />
      ))}

      <Popover
        open={popoverOpen}
        onOpenChange={(open) => {
          setPopoverOpen(open);
        }}
      >
        <PopoverTrigger render={<Button variant="outline" size="sm" />}>
          <Plus className="h-3.5 w-3.5" data-icon="inline-start" />
          新增篩選
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0">
          {popoverOpen && (
            <FilterPopover
              config={config}
              activeFilters={activeFilters}
              onSelect={addFilter}
            />
          )}
        </PopoverContent>
      </Popover>

      {activeFilters.length >= 2 && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          清除全部
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterChip
// ---------------------------------------------------------------------------

interface FilterChipProps {
  filter: ActiveFilter;
  config: FilterConfig;
  relationLabels?: Record<string, string>;
  onRemove: () => void;
}

function FilterChip({ filter, config, relationLabels, onRemove }: FilterChipProps) {
  const resolved = resolveFilterLabel(filter, config, relationLabels);
  if (!resolved) return null;

  return (
    <Badge variant="secondary" className="gap-1 pl-2 pr-1">
      {resolved.fieldLabel}: {resolved.valueLabel}
      <button
        type="button"
        className="ml-0.5 rounded-full p-0.5 outline-none hover:bg-muted"
        onClick={onRemove}
        aria-label={`移除篩選 ${resolved.fieldLabel}`}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// FilterPopover — two-step flow (remounted each time popover opens)
// ---------------------------------------------------------------------------

interface FilterPopoverProps {
  config: FilterConfig;
  activeFilters: ActiveFilter[];
  onSelect: (field: string, value: string) => void;
}

type RelationLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; options: { id: string; label: string }[] };

function FilterPopover({
  config,
  activeFilters,
  onSelect,
}: FilterPopoverProps) {
  const [selectedField, setSelectedField] = useState<FilterFieldConfig | null>(
    null,
  );
  const [relationState, setRelationState] = useState<RelationLoadState>({
    status: "idle",
  });

  const availableFields = config.filter(
    (fc) => !activeFilters.some((af) => af.field === fc.field),
  );

  const loadRelationOptions = useCallback(
    async (fieldConfig: FilterFieldConfig) => {
      if (fieldConfig.type !== "relation") return;
      const loader = RELATION_LOADERS[fieldConfig.field];
      if (!loader) {
        setRelationState({ status: "loaded", options: [] });
        return;
      }
      setRelationState({ status: "loading" });
      try {
        const options = await loader();
        setRelationState({ status: "loaded", options });
      } catch {
        setRelationState({ status: "error" });
      }
    },
    [],
  );

  const handleFieldSelect = useCallback(
    (fieldConfig: FilterFieldConfig) => {
      setSelectedField(fieldConfig);
      if (fieldConfig.type === "relation") {
        loadRelationOptions(fieldConfig);
      }
    },
    [loadRelationOptions],
  );

  const handleRetry = useCallback(() => {
    if (selectedField) {
      loadRelationOptions(selectedField);
    }
  }, [selectedField, loadRelationOptions]);

  // Step 1: Select field
  if (!selectedField) {
    return (
      <Command>
        <CommandList>
          {availableFields.length === 0 ? (
            <CommandEmpty>所有欄位已篩選</CommandEmpty>
          ) : (
            <CommandGroup heading="選擇篩選欄位">
              {availableFields.map((fc) => (
                <CommandItem
                  key={fc.field}
                  value={fc.label}
                  onSelect={() => handleFieldSelect(fc)}
                >
                  {fc.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    );
  }

  // Step 2: Select value

  // DateRange uses a custom form instead of Command
  if (selectedField.type === "dateRange") {
    return <DateRangeForm field={selectedField.field} label={selectedField.label} onSelect={onSelect} />;
  }

  return (
    <Command>
      <CommandList>
        {selectedField.type === "enum" && (
          <CommandGroup heading={selectedField.label}>
            {Object.entries(selectedField.options).map(([value, label]) => (
              <CommandItem
                key={value}
                value={label}
                onSelect={() => onSelect(selectedField.field, value)}
              >
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {selectedField.type === "boolean" && (
          <CommandGroup heading={selectedField.label}>
            <CommandItem
              value={selectedField.trueLabel}
              onSelect={() => onSelect(selectedField.field, "true")}
            >
              {selectedField.trueLabel}
            </CommandItem>
            <CommandItem
              value={selectedField.falseLabel}
              onSelect={() => onSelect(selectedField.field, "false")}
            >
              {selectedField.falseLabel}
            </CommandItem>
          </CommandGroup>
        )}

        {selectedField.type === "relation" && (
          <>
            {relationState.status === "loading" && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {relationState.status === "error" && (
              <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
                <span>載入失敗，請重試</span>
                <Button variant="outline" size="xs" onClick={handleRetry}>
                  重試
                </Button>
              </div>
            )}

            {relationState.status === "loaded" &&
              relationState.options.length === 0 && (
                <CommandEmpty>無可用選項</CommandEmpty>
              )}

            {relationState.status === "loaded" &&
              relationState.options.length > 0 && (
                <CommandGroup heading={selectedField.label}>
                  {relationState.options.map((opt) => (
                    <CommandItem
                      key={opt.id}
                      value={opt.label}
                      onSelect={() => onSelect(selectedField.field, opt.id)}
                    >
                      {opt.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
          </>
        )}
      </CommandList>
    </Command>
  );
}

// ---------------------------------------------------------------------------
// DateRangeForm — inline date range picker for dateRange filter fields
// ---------------------------------------------------------------------------

function DateRangeForm({
  field,
  label,
  onSelect,
}: {
  field: string;
  label: string;
  onSelect: (field: string, value: string) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const isValid = from && to && from <= to;

  const handleApply = () => {
    if (isValid) {
      onSelect(field, `${from}..${to}`);
    }
  };

  return (
    <div className="space-y-3 p-3">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="space-y-2">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">從</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">到</label>
          <Input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>
      <Button
        size="sm"
        className="w-full"
        disabled={!isValid}
        onClick={handleApply}
      >
        套用
      </Button>
    </div>
  );
}
