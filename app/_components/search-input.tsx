"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  placeholder: string;
  /** URL query parameter name, default "q" */
  paramName?: string;
  /** Debounce delay in ms, default 300 */
  debounceMs?: number;
  className?: string;
}

export function SearchInput({
  placeholder,
  paramName = "q",
  debounceMs = 300,
  className,
}: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [value, setValue] = useState(searchParams.get(paramName) ?? "");

  // Sync input value when URL param changes externally
  useEffect(() => {
    setValue(searchParams.get(paramName) ?? "");
  }, [searchParams, paramName]);

  // Debounced URL param update
  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
          params.set(paramName, value);
        } else {
          params.delete(paramName);
        }
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      });
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [value, router, pathname, searchParams, startTransition, paramName, debounceMs]);

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
    </div>
  );
}
