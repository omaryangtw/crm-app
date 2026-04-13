"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { staffCreateSchema } from "@/app/_lib/schemas/staff-schema";
import type { z } from "zod";

type StaffFormValues = z.input<typeof staffCreateSchema>;

interface StaffFormProps {
  defaultValues?: Partial<StaffFormValues>;
  onSubmitAction: (
    formData: FormData
  ) => Promise<{ success: boolean; error?: string; data?: { id: number } }>;
  submitLabel: string;
}

const inputClass =
  "w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
const labelClass = "mb-1 block text-sm font-medium";
const errorClass = "mt-1 text-sm text-destructive";
const sectionClass = "rounded-lg border bg-card p-4 shadow-sm space-y-4";

export default function StaffForm({
  defaultValues,
  onSubmitAction,
  submitLabel,
}: StaffFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StaffFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(staffCreateSchema) as any,
    defaultValues: defaultValues ?? {},
  });

  async function onSubmit(data: StaffFormValues) {
    setServerError(null);
    const formData = new FormData();

    for (const [key, value] of Object.entries(data)) {
      if (key === "aliases") continue; // handled separately below
      if (value === null || value === undefined || value === "") continue;
      formData.append(key, String(value));
    }

    // Convert comma-separated aliases string to individual entries
    const aliasesRaw = (data as Record<string, unknown>).aliases;
    const aliasesStr = typeof aliasesRaw === "string" ? aliasesRaw : "";
    const aliases = aliasesStr
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    formData.append("aliases", JSON.stringify(aliases));

    const result = await onSubmitAction(formData);
    if (!result.success) {
      setServerError(result.error ?? "發生未知錯誤");
      return;
    }
    router.push(`/staff/${result.data?.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <fieldset className={sectionClass}>
        <legend className="px-2 text-base font-semibold">員工資料</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="name" className={labelClass}>
              姓名 *
            </label>
            <input
              id="name"
              type="text"
              className={inputClass}
              {...register("name")}
            />
            {errors.name && (
              <p className={errorClass}>{errors.name.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>
              電子郵件
            </label>
            <input
              id="email"
              type="text"
              className={inputClass}
              {...register("email")}
            />
            {errors.email && (
              <p className={errorClass}>{errors.email.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="phone" className={labelClass}>
              電話
            </label>
            <input
              id="phone"
              type="text"
              className={inputClass}
              {...register("phone")}
            />
            {errors.phone && (
              <p className={errorClass}>{errors.phone.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="aliases" className={labelClass}>
              別名
            </label>
            <input
              id="aliases"
              type="text"
              className={inputClass}
              placeholder="以逗號分隔，例如：AliasA, StaffA"
              {...register("aliases")}
            />
          </div>
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
