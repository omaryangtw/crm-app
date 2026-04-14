"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONTACT_TYPE_LABELS } from "@/app/_lib/constants/enums";
import { createContact } from "@/app/_lib/actions/contact-actions";
import CaseSelector from "@/app/_components/case-selector";
import { FormGrid } from "@/app/_components/form-grid";

interface QuickContactFormProps {
  /** 族人 ID（必填） */
  clientId: number;
  /** 當前登入使用者的 staffId */
  sessionStaffId: number | null;
  /** 預設關聯的案件 ID（從案件詳情頁使用時傳入） */
  defaultCaseId?: number;
  /** 表單送出成功後的回呼 */
  onSuccess?: () => void;
}

const labelClass = "mb-1 block text-sm font-medium";

export const QUICK_ACTIONS = [
  { label: "撥出未接", contactType: "outgoing", isSuccess: false, record: "撥出未接" },
  { label: "撥出已接", contactType: "outgoing", isSuccess: true,  record: "" },
  { label: "來電",     contactType: "incoming", isSuccess: true,  record: "" },
  { label: "親訪未遇", contactType: "visit",    isSuccess: false, record: "親訪未遇" },
] as const;

export const CONTACT_TEMPLATES = [
  "確認地址無誤",
  "約定下次訪視",
  "轉介相關資源",
  "關懷問候",
  "通知活動訊息",
] as const;

export default function QuickContactForm({
  clientId,
  sessionStaffId,
  defaultCaseId,
  onSuccess,
}: QuickContactFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [isQuickActionPending, setIsQuickActionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactType, setContactType] = useState<string>("");
  const [isSuccess, setIsSuccess] = useState(true);
  const [record, setRecord] = useState("");

  async function handleQuickAction(action: (typeof QUICK_ACTIONS)[number]) {
    setIsQuickActionPending(true);
    try {
      const formData = new FormData();
      formData.set("clientId", String(clientId));
      formData.set("date", new Date().toISOString().slice(0, 10));
      if (sessionStaffId) {
        formData.set("staffInChargeIds", String(sessionStaffId));
      }
      formData.set("contactType", action.contactType);
      formData.set("isSuccess", String(action.isSuccess));
      if (action.record) {
        formData.set("record", action.record);
      }

      // Read caseId from CaseSelector hidden input
      if (formRef.current) {
        const caseInput =
          formRef.current.querySelector<HTMLInputElement>('input[name="caseId"]');
        if (caseInput?.value) {
          formData.set("caseId", caseInput.value);
        }
      }

      const result = await createContact(formData);
      if (!result.success) {
        toast.error(result.error ?? "發生未知錯誤");
        return;
      }
      toast.success(`已建立通聯紀錄：${action.label}`);
      router.refresh();
      onSuccess?.();
    } catch {
      toast.error("發生未知錯誤");
    } finally {
      setIsQuickActionPending(false);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("clientId", String(clientId));
    formData.set("date", new Date().toISOString().slice(0, 10));
    if (sessionStaffId) {
      formData.set("staffInChargeIds", String(sessionStaffId));
    }
    if (contactType) {
      formData.set("contactType", contactType);
    }
    formData.set("isSuccess", String(isSuccess));
    if (record.trim()) {
      formData.set("record", record.trim());
    }

    // Read caseId from CaseSelector hidden input
    if (formRef.current) {
      const caseInput =
        formRef.current.querySelector<HTMLInputElement>('input[name="caseId"]');
      if (caseInput?.value) {
        formData.set("caseId", caseInput.value);
      }
    }

    startTransition(async () => {
      const result = await createContact(formData);
      if (!result.success) {
        setError(result.error ?? "發生未知錯誤");
        return;
      }
      // Reset form
      setContactType("");
      setIsSuccess(true);
      setRecord("");
      setError(null);
      router.refresh();
      onSuccess?.();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.label}
            type="button"
            variant="outline"
            size="sm"
            disabled={isQuickActionPending || isPending}
            onClick={() => handleQuickAction(action)}
          >
            {action.label}
          </Button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <FormGrid>
        {/* 通聯類型 */}
        <div>
          <label className={labelClass}>通聯類型</label>
          <Select value={contactType} onValueChange={(val) => setContactType(val ?? "")}>
            <SelectTrigger className="w-full">
              {contactType
                ? CONTACT_TYPE_LABELS[contactType] ?? contactType
                : <SelectValue placeholder="-- 請選擇 --" />}
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(CONTACT_TYPE_LABELS).map(([value, display]) => (
                  <SelectItem key={value} value={value}>
                    {display}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* 成功 Checkbox */}
        <div className="flex items-center gap-2 self-end pb-1">
          <input
            id="quick-isSuccess"
            type="checkbox"
            checked={isSuccess}
            onChange={(e) => setIsSuccess(e.target.checked)}
          />
          <label htmlFor="quick-isSuccess" className="text-sm font-medium">
            成功
          </label>
        </div>

        {/* 關聯案件 */}
        <CaseSelector
          clientId={clientId}
          name="caseId"
          defaultValue={defaultCaseId}
          label="關聯案件"
        />
      </FormGrid>

      {/* 紀錄 Textarea + 範本按鈕 */}
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="quick-record" className={labelClass}>
            紀錄
          </label>
          {/* Template dropdown — Task 6.3 */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" type="button" />}
            >
              範本
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {CONTACT_TEMPLATES.map((tpl) => (
                <DropdownMenuItem
                  key={tpl}
                  onSelect={() => {
                    setRecord((prev) => (prev === "" ? tpl : prev + "\n" + tpl));
                  }}
                >
                  {tpl}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Textarea
          id="quick-record"
          rows={3}
          placeholder="輸入通聯紀錄..."
          value={record}
          onChange={(e) => setRecord(e.target.value)}
        />
      </div>

      {/* 送出 / 取消 */}
      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "送出中..." : "送出"}
        </Button>
      </div>
    </form>
  );
}
