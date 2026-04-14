"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CASE_STATUS_LABELS } from "@/app/_lib/constants/enums";
import { getCasesByClientId } from "@/app/_lib/actions/case-actions";

interface CaseSelectorProps {
  /** 族人 ID，用於載入該族人的案件列表 */
  clientId?: number;
  /** Form field name, e.g. "caseId" */
  name: string;
  /** 預填已選案件 ID */
  defaultValue?: number;
  /** 是否禁用（例如尚未選擇族人時） */
  disabled?: boolean;
  /** Label text */
  label?: string;
}

type CaseOption = { id: number; name: string | null; status: string | null };

export default function CaseSelector({
  clientId,
  name,
  defaultValue,
  disabled = false,
  label = "關聯案件",
}: CaseSelectorProps) {
  const [cases, setCases] = useState<CaseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedValue, setSelectedValue] = useState<string>(
    defaultValue ? String(defaultValue) : "",
  );

  // Load cases when clientId changes
  useEffect(() => {
    if (!clientId) {
      setCases([]);
      setSelectedValue("");
      return;
    }

    let cancelled = false;
    setLoading(true);

    getCasesByClientId(clientId).then((data) => {
      if (cancelled) return;
      setCases(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Reset selection when clientId changes (but keep defaultValue on first mount)
  useEffect(() => {
    if (!clientId) {
      setSelectedValue("");
    }
  }, [clientId]);

  const isDisabled = disabled || !clientId;

  const placeholder = disabled
    ? "請先選擇族人"
    : loading
      ? "載入中..."
      : cases.length === 0 && clientId
        ? "此族人尚無案件"
        : "不關聯案件";

  return (
    <div className="space-y-1">
      {label && (
        <label className="mb-1 block text-sm font-medium">{label}</label>
      )}
      {/* Hidden input for FormData submission */}
      <input type="hidden" name={name} value={selectedValue} />
      <Select
        value={selectedValue}
        onValueChange={(val) => setSelectedValue(val ?? "")}
        disabled={isDisabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="">不關聯案件</SelectItem>
            {cases.map((c) => {
              const statusLabel = c.status
                ? CASE_STATUS_LABELS[c.status] ?? c.status
                : "";
              const displayText = statusLabel
                ? `${c.name ?? "未命名案件"} — ${statusLabel}`
                : (c.name ?? "未命名案件");
              return (
                <SelectItem key={c.id} value={String(c.id)}>
                  {displayText}
                </SelectItem>
              );
            })}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
