"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { ChevronsUpDown } from "lucide-react";
import { searchClientsByName } from "@/app/_lib/actions/client-search-action";

interface ClientSelectorProps {
  /** Form field name, e.g. "clientId" */
  name: string;
  /** Pre-selected client ID for edit forms */
  defaultValue?: number;
  /** Label text, default "關聯族人" */
  label?: string;
  /** Validation error message */
  error?: string;
  /** Callback when selected client changes */
  onClientChange?: (clientId: number | null) => void;
}

export default function ClientSelector({
  name,
  defaultValue,
  label = "關聯族人",
  error,
  onClientChange,
}: ClientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [results, setResults] = useState<{ id: number; name: string | null }[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch client name on mount when defaultValue is provided
  useEffect(() => {
    if (defaultValue && !selectedClient) {
      void (async () => {
        const { getClientNameById } = await import(
          "@/app/_lib/actions/client-search-action"
        );
        const clientName = await getClientNameById(defaultValue);
        if (clientName) {
          setSelectedClient({ id: defaultValue, name: clientName });
          onClientChange?.(defaultValue);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue]);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const data = await searchClientsByName(value);
      setResults(data);
      setLoading(false);
    }, 300);
  }, []);

  const handleSelect = (client: { id: number; name: string | null }) => {
    setSelectedClient({ id: client.id, name: client.name ?? "" });
    setOpen(false);
    setSearch("");
    setResults([]);
    onClientChange?.(client.id);
  };

  const displayText = selectedClient
    ? `${selectedClient.name} (ID: ${selectedClient.id})`
    : "選擇族人...";

  return (
    <div className="space-y-1">
      {label && (
        <label className="mb-1 block text-sm font-medium">{label}</label>
      )}
      <input
        type="hidden"
        name={name}
        value={selectedClient?.id ?? ""}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal"
            />
          }
        >
          <span className="truncate">{displayText}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="輸入姓名搜尋..."
              value={search}
              onValueChange={handleSearch}
            />
            <CommandList>
              {loading && (
                <CommandEmpty>搜尋中...</CommandEmpty>
              )}
              {!loading && search.length >= 2 && results.length === 0 && (
                <CommandEmpty>找不到族人，請確認姓名</CommandEmpty>
              )}
              {!loading && search.length < 2 && results.length === 0 && (
                <CommandEmpty>請輸入至少 2 個字元</CommandEmpty>
              )}
              <CommandGroup>
                {results.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={String(client.id)}
                    onSelect={() => handleSelect(client)}
                  >
                    {client.name ?? "—"} (ID: {client.id})
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
