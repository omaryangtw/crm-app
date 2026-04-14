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
import { contactCreateSchema } from "@/app/_lib/schemas/contact-schema";
import type { z } from "zod";
import { CONTACT_TYPE_LABELS } from "@/app/_lib/constants/enums";
import StaffSelector from "@/app/_components/staff-selector";
import ClientSelector from "@/app/_components/client-selector";
import { FormGrid } from "@/app/_components/form-grid";

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

const selectClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "mb-1 block text-sm font-medium";
const errorClass = "mt-1 text-sm text-destructive";

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
    } else if (formRef.current) {
      const clientInput = formRef.current.querySelector<HTMLInputElement>('input[name="clientId"]');
      if (clientInput?.value) {
        router.push(`/clients/${clientInput.value}`);
      } else {
        router.push("/contacts");
      }
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

      {/* 通聯資料 */}
      <Card>
        <CardHeader>
          <CardTitle>通聯資料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormGrid>
            <div>
              <label htmlFor="date" className={labelClass}>
                日期
              </label>
              <Input
                id="date"
                type="date"
                {...register("date")}
              />
            </div>
            <div>
              <label htmlFor="contactType" className={labelClass}>
                類型
              </label>
              <select
                id="contactType"
                className={selectClass}
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
          </FormGrid>
          <div>
            <label htmlFor="record" className={labelClass}>
              紀錄
            </label>
            <textarea
              id="record"
              rows={4}
              className={selectClass}
              {...register("record")}
            />
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
