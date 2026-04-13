"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  clientCreateSchema,
} from "@/app/_lib/schemas/client-schema";
import type { z } from "zod";

// Use the input type (before defaults are applied) for the form,
// since react-hook-form deals with user input where defaults are optional.
type ClientFormValues = z.input<typeof clientCreateSchema>;
import {
  SEX_LABELS,
  INCOME_STATUS_LABELS,
  DISABLED_STATUS_LABELS,
  INDIGENOUS_GROUP_LABELS,
  PLAIN_MOUNTAIN_LABELS,
} from "@/app/_lib/constants/enums";

interface ClientFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValues?: Record<string, any>;
  onSubmitAction: (formData: FormData) => Promise<{ success: boolean; error?: string; data?: { id: number } }>;
  submitLabel: string;
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

function CheckboxField({
  id,
  label,
  registration,
}: {
  id: string;
  label: string;
  registration: ReturnType<ReturnType<typeof useForm>["register"]>;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <input id={id} type="checkbox" className="rounded border" {...registration} />
      {label}
    </label>
  );
}

export default function ClientForm({ defaultValues, onSubmitAction, submitLabel }: ClientFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(clientCreateSchema) as any,
    defaultValues: {
      isDead: false,
      householdAdmin: false,
      canCall: true,
      canMail: true,
      ...defaultValues,
    },
  });

  async function onSubmit(data: ClientFormValues) {
    setServerError(null);
    const formData = new FormData();

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined || value === "") continue;
      if (value instanceof Date) {
        formData.append(key, value.toISOString());
      } else {
        formData.append(key, String(value));
      }
    }

    // Ensure boolean fields are always sent (unchecked checkboxes are omitted by default)
    for (const boolField of ["isDead", "householdAdmin", "canCall", "canMail"]) {
      if (!formData.has(boolField)) {
        formData.set(boolField, "false");
      }
    }

    const result = await onSubmitAction(formData);
    if (!result.success) {
      setServerError(result.error ?? "發生未知錯誤");
      return;
    }
    router.push(`/clients/${result.data?.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      {/* 基本資料 */}
      <fieldset className={sectionClass}>
        <legend className="px-2 text-base font-semibold">基本資料</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="name" className={labelClass}>姓名 *</label>
            <input id="name" type="text" className={inputClass} {...register("name")} />
            {errors.name && <p className={errorClass}>{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="nameAlt" className={labelClass}>別名</label>
            <input id="nameAlt" type="text" className={inputClass} {...register("nameAlt")} />
          </div>
          <div>
            <label htmlFor="idn" className={labelClass}>身分證字號</label>
            <input id="idn" type="text" className={inputClass} {...register("idn")} />
          </div>
          <SelectField id="sex" label="性別" options={SEX_LABELS} registration={register("sex")} error={errors.sex?.message} />
          <div>
            <label htmlFor="birthday" className={labelClass}>生日</label>
            <input id="birthday" type="date" className={inputClass} {...register("birthday")} />
            {errors.birthday && <p className={errorClass}>{errors.birthday.message}</p>}
          </div>
          <SelectField id="incomeStatus" label="收入狀態" options={INCOME_STATUS_LABELS} registration={register("incomeStatus")} error={errors.incomeStatus?.message} />
          <SelectField id="disabledStatus" label="身障狀態" options={DISABLED_STATUS_LABELS} registration={register("disabledStatus")} error={errors.disabledStatus?.message} />
          <SelectField id="indigenousGroup" label="族別" options={INDIGENOUS_GROUP_LABELS} registration={register("indigenousGroup")} error={errors.indigenousGroup?.message} />
          <div>
            <label htmlFor="tribe" className={labelClass}>部落</label>
            <input id="tribe" type="text" className={inputClass} {...register("tribe")} />
          </div>
          <SelectField id="plainMountain" label="平原/山原" options={PLAIN_MOUNTAIN_LABELS} registration={register("plainMountain")} error={errors.plainMountain?.message} />
          <div className="flex flex-wrap gap-6 sm:col-span-2 lg:col-span-3 pt-2">
            <CheckboxField id="isDead" label="已歿" registration={register("isDead")} />
            <CheckboxField id="householdAdmin" label="戶長" registration={register("householdAdmin")} />
          </div>
        </div>
      </fieldset>

      {/* 電話資料 */}
      <fieldset className={sectionClass}>
        <legend className="px-2 text-base font-semibold">電話資料</legend>
        <div className="mb-2">
          <CheckboxField id="canCall" label="可聯繫電話" registration={register("canCall")} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className={labelClass}>電話</label>
            <input id="phone" type="text" className={inputClass} {...register("phone")} />
          </div>
          <div>
            <label htmlFor="phoneNote" className={labelClass}>電話備註</label>
            <input id="phoneNote" type="text" className={inputClass} {...register("phoneNote")} />
          </div>
          <div>
            <label htmlFor="phoneAlt" className={labelClass}>電話（備用）</label>
            <input id="phoneAlt" type="text" className={inputClass} {...register("phoneAlt")} />
          </div>
          <div>
            <label htmlFor="phoneAltNote" className={labelClass}>電話（備用）備註</label>
            <input id="phoneAltNote" type="text" className={inputClass} {...register("phoneAltNote")} />
          </div>
          <div>
            <label htmlFor="mobile" className={labelClass}>手機</label>
            <input id="mobile" type="text" className={inputClass} {...register("mobile")} />
          </div>
          <div>
            <label htmlFor="mobileNote" className={labelClass}>手機備註</label>
            <input id="mobileNote" type="text" className={inputClass} {...register("mobileNote")} />
          </div>
          <div>
            <label htmlFor="mobileAlt" className={labelClass}>手機（備用）</label>
            <input id="mobileAlt" type="text" className={inputClass} {...register("mobileAlt")} />
          </div>
          <div>
            <label htmlFor="mobileAltNote" className={labelClass}>手機（備用）備註</label>
            <input id="mobileAltNote" type="text" className={inputClass} {...register("mobileAltNote")} />
          </div>
        </div>
      </fieldset>

      {/* 地址資料 */}
      <fieldset className={sectionClass}>
        <legend className="px-2 text-base font-semibold">地址資料</legend>
        <div className="mb-2">
          <CheckboxField id="canMail" label="可寄送郵件" registration={register("canMail")} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="city" className={labelClass}>縣市</label>
            <input id="city" type="text" className={inputClass} {...register("city")} />
          </div>
          <div>
            <label htmlFor="dist" className={labelClass}>區域</label>
            <input id="dist" type="text" className={inputClass} {...register("dist")} />
          </div>
          <div>
            <label htmlFor="vill" className={labelClass}>里</label>
            <input id="vill" type="text" className={inputClass} {...register("vill")} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="addr" className={labelClass}>地址</label>
            <input id="addr" type="text" className={inputClass} {...register("addr")} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="addrNote" className={labelClass}>地址備註</label>
            <input id="addrNote" type="text" className={inputClass} {...register("addrNote")} />
          </div>
        </div>

        <hr className="my-4" />
        <p className="text-sm text-muted-foreground mb-2">備用地址</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label htmlFor="cityAlt" className={labelClass}>縣市（備用）</label>
            <input id="cityAlt" type="text" className={inputClass} {...register("cityAlt")} />
          </div>
          <div>
            <label htmlFor="distAlt" className={labelClass}>區域（備用）</label>
            <input id="distAlt" type="text" className={inputClass} {...register("distAlt")} />
          </div>
          <div>
            <label htmlFor="villAlt" className={labelClass}>里（備用）</label>
            <input id="villAlt" type="text" className={inputClass} {...register("villAlt")} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="addrAlt" className={labelClass}>地址（備用）</label>
            <input id="addrAlt" type="text" className={inputClass} {...register("addrAlt")} />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <label htmlFor="addrAltNote" className={labelClass}>地址（備用）備註</label>
            <input id="addrAltNote" type="text" className={inputClass} {...register("addrAltNote")} />
          </div>
        </div>
      </fieldset>

      {/* 備註 */}
      <fieldset className={sectionClass}>
        <legend className="px-2 text-base font-semibold">備註</legend>
        <div>
          <label htmlFor="note" className={labelClass}>備註</label>
          <textarea id="note" rows={4} className={inputClass} {...register("note")} />
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
