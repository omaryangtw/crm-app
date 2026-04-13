"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { contactCreateSchema } from "@/app/_lib/schemas/contact-schema";
import type { z } from "zod";
import { CONTACT_TYPE_LABELS } from "@/app/_lib/constants/enums";
import StaffSelector from "@/app/_components/staff-selector";

type ContactFormValues = z.input<typeof contactCreateSchema>;

interface ContactFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValues?: Record<string, any>;
  onSubmitAction: (
    formData: FormData
  ) => Promise<{ success: boolean; error?: string; data?: { id: number } }>;
  submitLabel: string;
  /** Pre-filled clientId (for create from client detail) */
  clientId?: number;
}

const inputClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "mb-1 block text-sm font-medium";
const errorClass = "mt-1 text-sm text-destructive";
const sectionClass = "rounded-lg border bg-card p-4 shadow-sm space-y-4";

export default function ContactForm({
  defaultValues,
  onSubmitAction,
  submitLabel,
  clientId,
}: ContactFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(contactCreateSchema) as any,
    defaultValues: {
      clientId: clientId ?? defaultValues?.clientId,
      isSuccess: true,
      ...defaultValues,
    },
  });

  async function onSubmit(data: ContactFormValues) {
    setServerError(null);
    const formData = new FormData();

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined || value === "") continue;
      formData.append(key, String(value));
    }

    // Capture staffInChargeIds from the hidden input in StaffSelector
    if (formRef.current) {
      const hiddenInput = formRef.current.querySelector<HTMLInputElement>(
        'input[name="staffInChargeIds"]'
      );
      if (hiddenInput) {
        formData.set("staffInChargeIds", hiddenInput.value);
      }
    }

    const result = await onSubmitAction(formData);
    if (!result.success) {
      setServerError(result.error ?? "發生未知錯誤");
      return;
    }
    // Navigate back to the client detail page if clientId is available
    if (data.clientId) {
      router.push(`/clients/${data.clientId}`);
    } else {
      router.push("/contacts");
    }
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      {/* 關聯族人 */}
      <fieldset className={sectionClass}>
        <legend className="px-2 text-base font-semibold">關聯族人</legend>
        <div>
          <label htmlFor="clientId" className={labelClass}>
            族人 ID *
          </label>
          <input
            id="clientId"
            type="number"
            className={inputClass}
            {...register("clientId", { valueAsNumber: true })}
          />
          {errors.clientId && (
            <p className={errorClass}>{errors.clientId.message}</p>
          )}
        </div>
      </fieldset>

      {/* 通聯資料 */}
      <fieldset className={sectionClass}>
        <legend className="px-2 text-base font-semibold">通聯資料</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="date" className={labelClass}>
              日期
            </label>
            <input
              id="date"
              type="date"
              className={inputClass}
              {...register("date")}
            />
          </div>
          <div>
            <label htmlFor="contactType" className={labelClass}>
              類型
            </label>
            <select
              id="contactType"
              className={inputClass}
              {...register("contactType")}
            >
              <option value="">-- 請選擇 --</option>
              {Object.entries(CONTACT_TYPE_LABELS).map(([value, display]) => (
                <option key={value} value={value}>
                  {display}
                </option>
              ))}
            </select>
          </div>
          <StaffSelector
            name="staffInChargeIds"
            defaultValue={defaultValues?.staffInChargeIds ?? []}
          />
          <div className="flex items-center gap-2">
            <input
              id="isSuccess"
              type="checkbox"
              defaultChecked={defaultValues?.isSuccess ?? true}
              {...register("isSuccess")}
            />
            <label htmlFor="isSuccess" className="text-sm font-medium">
              成功
            </label>
          </div>
        </div>
        <div>
          <label htmlFor="record" className={labelClass}>
            紀錄
          </label>
          <textarea
            id="record"
            rows={4}
            className={inputClass}
            {...register("record")}
          />
        </div>
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "儲存中..." : submitLabel}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          取消
        </Button>
      </div>
    </form>
  );
}
