"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { GlobalSearchDialog } from "./global-search-dialog";

export function GlobalSearchTrigger() {
  const [open, setOpen] = useState(false);

  // Global keyboard shortcut: ⌘K (Mac) / Ctrl+K (Windows/Linux)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* Desktop trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden lg:inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        <Search className="size-4" />
        <span>搜尋...</span>
        <kbd className="ml-2 rounded border border-border bg-muted px-1.5 py-0.5 text-xs">
          ⌘K
        </kbd>
      </button>

      <GlobalSearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function GlobalSearchMobileTrigger({
  onAfterClick,
}: {
  onAfterClick?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          onAfterClick?.();
        }}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
      >
        <Search className="size-4" />
        搜尋
      </button>

      <GlobalSearchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
