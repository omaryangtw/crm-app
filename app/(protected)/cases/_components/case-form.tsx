"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { caseCreateSchema } from "@/app/_lib/schemas/case-schema";
import type { z } from "zod";
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_MAJOR_LABELS,
  CASE_TYPE_MINOR_LABELS,
} from "@/app/_lib/constants/enums";
import StaffSelector from "@/app/_components/staff-selector";
import ClientSelector from "@/app/_components/client-selector";
import { FormGrid } from "@/app/_components/form-grid";

type CaseFormValues = z.input<typeof caseCreateSchema>;

interface CaseFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValues?: Record<string, any>;
  onSubmitAction: (formData: FormData) => Promise<{ success: boolean; error?: string; data?: { id: number } }>;
  submitLabel: string;
  /** Pre-filled clientId (for create from client detail) */
  clientId?: number;
  /** 當前登入使用者綁定的 staffId，用於新增時自動預填 */
  sessionStaffId?: number | null;
}

const selectClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "mb-1 block text-sm font-medium";
const errorClass = "mt-1 text-sm text-destructive";

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
      <select id={id} className={selectClass} {...registration}>
        <option value="">-- 請選擇 --</option>
        {Object.entries(options).map(([value, display]) => (
          <option key={value} value={value}>{display}</option>
        ))}
      </select>
      {error && <p className={errorClass}>{error}</p>}
    </div>
  );
}

export default function CaseForm({ defaultValues, onSubmitAction, submitLabel, clientId, sessionStaffId }: CaseFormProps) {
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
      if (key === "clientId") continue; // handled by ClientSelector hidden input
      if (value === null || value === undefined || value === "") continue;
      formData.append(key, String(value));
    }

    // Capture clientId from the hidden input in ClientSelector
    if (formRef.current) {
      const clientInput = formRef.current.querySelector<HTMLInputElement>('input[name="clientId"]');
      if (clientInput && clientInput.value) {
        formData.set("clientId", clientInput.value);
      }
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
      <Card>
        <CardHeader>
          <CardTitle>關聯族人</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientSelector
            name="clientId"
            defaultValue={clientId ?? defaultValues?.clientId}
            label="族人 *"
            error={errors.clientId?.message}
          />
        </CardContent>
      </Card>

      {/* 案件基本資料 */}
      <Card>
        <CardHeader>
          <CardTitle>案件資料</CardTitle>
        </CardHeader>
        <CardContent>
          <FormGrid>
            <div>
              <label htmlFor="name" className={labelClass}>案件名稱</label>
              <Input id="name" type="text" {...register("name")} />
              {errors.name && <p className={errorClass}>{errors.name.message}</p>}
            </div>
            <SelectField
              id="status"
              label="狀態"
              options={CASE_STATUS_LABELS}
              registration={register("status")}
              error={errors.status?.message}
            />
            <StaffSelector name="staffInChargeIds" defaultValue={defaultValues?.staffInChargeIds ?? (sessionStaffId ? [sessionStaffId] : [])} />
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
          </FormGrid>
        </CardContent>
      </Card>

      {/* 關係人 */}
      <Card>
        <CardHeader>
          <CardTitle>關係人</CardTitle>
        </CardHeader>
        <CardContent>
          <FormGrid>
            <div>
              <label htmlFor="relation1" className={labelClass}>關係人 1</label>
              <Input id="relation1" type="text" {...register("relation1")} />
            </div>
            <div>
              <label htmlFor="relation2" className={labelClass}>關係人 2</label>
              <Input id="relation2" type="text" {...register("relation2")} />
            </div>
            <div>
              <label htmlFor="relation3" className={labelClass}>關係人 3</label>
              <Input id="relation3" type="text" {...register("relation3")} />
            </div>
          </FormGrid>
        </CardContent>
      </Card>

      {/* 聯絡人 */}
      <Card>
        <CardHeader>
          <CardTitle>聯絡人</CardTitle>
        </CardHeader>
        <CardContent>
          <FormGrid>
            <div>
              <label htmlFor="contact1" className={labelClass}>聯絡人 1</label>
              <Input id="contact1" type="text" {...register("contact1")} />
            </div>
            <div>
              <label htmlFor="contact2" className={labelClass}>聯絡人 2</label>
              <Input id="contact2" type="text" {...register("contact2")} />
            </div>
            <div>
              <label htmlFor="contact3" className={labelClass}>聯絡人 3</label>
              <Input id="contact3" type="text" {...register("contact3")} />
            </div>
          </FormGrid>
        </CardContent>
      </Card>

      {/* 備註與處理 */}
      <Card>
        <CardHeader>
          <CardTitle>備註與處理</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="note" className={labelClass}>備註</label>
            <textarea id="note" rows={4} className={selectClass} {...register("note")} />
          </div>
          <div>
            <label htmlFor="handle" className={labelClass}>處理情形</label>
            <textarea id="handle" rows={4} className={selectClass} {...register("handle")} />
          </div>
        </CardContent>
      </Card>

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
