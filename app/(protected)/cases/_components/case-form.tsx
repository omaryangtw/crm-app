"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { caseCreateSchema } from "@/app/_lib/schemas/case-schema";
import type { z } from "zod";
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_MAJOR_LABELS,
  CASE_TYPE_MINOR_LABELS,
} from "@/app/_lib/constants/enums";
import StaffSelector from "@/app/_components/staff-selector";

type CaseFormValues = z.input<typeof caseCreateSchema>;

interface CaseFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValues?: Record<string, any>;
  onSubmitAction: (formData: FormData) => Promise<{ success: boolean; error?: string; data?: { id: number } }>;
  submitLabel: string;
  /** Pre-filled clientId (for create from client detail) */
  clientId?: number;
}

const inputClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "mb-1 block text-sm font-medium";
const errorClass = "mt-1 text-sm text-destructive";
const sectionClass = "rounded-lg border bg-card p-4 shadow-sm space-y-4";

function SelectField({
  id,
  label,
  options,
  registration,
  error,
}: {
  id: string;
  label: string;
  options: Record<string, string>;
  registration: ReturnType<ReturnType<typeof useForm>["register"]>;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <select id={id} className={inputClass} {...registration}>
        <option value="">-- 請選擇 --</option>
        {Object.entries(options).map(([value, display]) => (
          <option key={value} value={value}>{display}</option>
        ))}
      </select>
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}

export default function CaseForm({ defaultValues, onSubmitAction, submitLabel, clientId }: CaseFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CaseFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(caseCreateSchema) as any,
    defaultValues: {
      clientId: clientId ?? defaultValues?.clientId,
      ...defaultValues,
    },
  });

  async function onSubmit(data: CaseFormValues) {
    setServerError(null);
    const formData = new FormData();

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined || value === "") continue;
      formData.append(key, String(value));
    }

    // Capture staffInChargeIds from the hidden input in StaffSelector
    if (formRef.current) {
      const hiddenInput = formRef.current.querySelector<HTMLInputElement>('input[name="staffInChargeIds"]');
      if (hiddenInput) {
        formData.set("staffInChargeIds", hiddenInput.value);
      }
    }

    const result = await onSubmitAction(formData);
    if (!result.success) {
      setServerError(result.error ?? "發生未知錯誤");
      return;
    }
    router.push(`/cases/${result.data?.id}`);
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
          <label htmlFor="clientId" className={labelClass}>族人 ID *</label>
          <input
            id="clientId"
            type="number"
            className={inputClass}
            {...register("clientId", { valueAsNumber: true })}
          />
          {errors.clientId && <p className={errorClass}>{errors.clientId.message}</p>}
        </div>
      </fieldset>

      {/* 案件基本資料 */}
      <fieldset className={sectionClass}>
        <legend className="px-2 text-base font-semibold">案件資料</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="name" className={labelClass}>案件名稱</label>
            <input id="name" type="text" className={inputClass} {...register("name")} />
            {errors.name && <p className={errorClass}>{errors.name.message}</p>}
          </div>
          <SelectField
            id="status"
            label="狀態"
            options={CASE_STATUS_LABELS}
            registration={register("status")}
            error={errors.status?.message}
          />
          <StaffSelector name="staffInChargeIds" defaultValue={defaultValues?.staffInChargeIds ?? []} />
          <SelectField
            id="typesMajor"
            label="案件大類"
            options={CASE_TYPE_MAJOR_LABELS}
            registration={register("typesMajor")}
            error={errors.typesMajor?.message}
          />
          <SelectField
            id="typesMinor"
            label="案件小類"
            options={CASE_TYPE_MINOR_LABELS}
            registration={register("typesMinor")}
            error={errors.typesMinor?.message}
          />
        </div>
      </fieldset>

      {/* 關係人 */}
      <fieldset className={sectionClass}>
        <legend className="px-2 text-base font-semibold">關係人</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="relation1" className={labelClass}>關係人 1</label>
            <input id="relation1" type="text" className={inputClass} {...register("relation1")} />
          </div>
          <div>
            <label htmlFor="relation2" className={labelClass}>關係人 2</label>
            <input id="relation2" type="text" className={inputClass} {...register("relation2")} />
          </div>
          <div>
            <label htmlFor="relation3" className={labelClass}>關係人 3</label>
            <input id="relation3" type="text" className={inputClass} {...register("relation3")} />
          </div>
        </div>
      </fieldset>

      {/* 聯絡人 */}
      <fieldset className={sectionClass}>
        <legend className="px-2 text-base font-semibold">聯絡人</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="contact1" className={labelClass}>聯絡人 1</label>
            <input id="contact1" type="text" className={inputClass} {...register("contact1")} />
          </div>
          <div>
            <label htmlFor="contact2" className={labelClass}>聯絡人 2</label>
            <input id="contact2" type="text" className={inputClass} {...register("contact2")} />
          </div>
          <div>
            <label htmlFor="contact3" className={labelClass}>聯絡人 3</label>
            <input id="contact3" type="text" className={inputClass} {...register("contact3")} />
          </div>
        </div>
      </fieldset>

      {/* 備註與處理 */}
      <fieldset className={sectionClass}>
        <legend className="px-2 text-base font-semibold">備註與處理</legend>
        <div>
          <label htmlFor="note" className={labelClass}>備註</label>
          <textarea id="note" rows={4} className={inputClass} {...register("note")} />
        </div>
        <div>
          <label htmlFor="handle" className={labelClass}>處理情形</label>
          <textarea id="handle" rows={4} className={inputClass} {...register("handle")} />
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
