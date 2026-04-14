"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { globalSearch } from "@/app/_lib/actions/search-actions";
import type { GlobalSearchResult } from "@/app/_lib/actions/search-actions";
import {
  maskIdn,
  truncateText,
  buildEntityHref,
} from "@/app/_lib/utils/search-utils";

const CASE_STATUS_LABELS: Record<string, string> = {
  in_progress: "處理中",
  closed: "結案",
  transferred: "轉介",
};

interface GlobalSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearchDialog({
  open,
  onOpenChange,
}: GlobalSearchDialogProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult>({
    clients: [],
    cases: [],
    contacts: [],
  });
  const [isPending, startTransition] = useTransition();
  const hasSearched = useRef(false);

  // Debounce search: 300ms after input ≥ 2 chars
  useEffect(() => {
    if (query.length < 2) {
      setResults({ clients: [], cases: [], contacts: [] });
      hasSearched.current = false;
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        const data = await globalSearch(query);
        setResults(data);
        hasSearched.current = true;
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults({ clients: [], cases: [], contacts: [] });
      hasSearched.current = false;
    }
  }, [open]);

  const handleSelect = (entityType: string, entityId: number) => {
    onOpenChange(false);
    router.push(buildEntityHref(entityType, entityId));
  };

  const hasResults =
    results.clients.length > 0 ||
    results.cases.length > 0 ||
    results.contacts.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="全域搜尋"
      description="搜尋族人、案件、通聯紀錄"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="搜尋族人、案件、通聯紀錄..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {hasSearched.current && !hasResults && !isPending && (
            <CommandEmpty>找不到符合的結果</CommandEmpty>
          )}

          {results.clients.length > 0 && (
            <CommandGroup heading="族人">
              {results.clients.map((client) => (
                <CommandItem
                  key={`client-${client.id}`}
                  value={`client-${client.id}`}
                  onSelect={() => handleSelect("Client", client.id)}
                >
                  <span className="font-medium">
                    {client.name ?? "(未命名)"}
                  </span>
                  <span className="ml-auto text-muted-foreground text-xs">
                    {maskIdn(client.idn)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.cases.length > 0 && (
            <CommandGroup heading="案件">
              {results.cases.map((c) => (
                <CommandItem
                  key={`case-${c.id}`}
                  value={`case-${c.id}`}
                  onSelect={() => handleSelect("Case", c.id)}
                >
                  <span className="font-medium">{c.name ?? "(未命名)"}</span>
                  <span className="text-muted-foreground text-xs">
                    {c.clientName ?? ""}
                  </span>
                  {c.status && (
                    <Badge variant="secondary" className="ml-auto">
                      {CASE_STATUS_LABELS[c.status] ?? c.status}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.contacts.length > 0 && (
            <CommandGroup heading="通聯紀錄">
              {results.contacts.map((ct) => (
                <CommandItem
                  key={`contact-${ct.id}`}
                  value={`contact-${ct.id}`}
                  onSelect={() => handleSelect("Contact", ct.id)}
                >
                  <span className="font-medium truncate">
                    {truncateText(ct.record ?? "", 50)}
                  </span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {ct.clientName ?? ""}
                  </span>
                  {ct.date && (
                    <span className="ml-auto text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(ct.date).toLocaleDateString("zh-TW")}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
