"use client";

import { useState } from "react";
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
import {
  clientCreateSchema,
} from "@/app/_lib/schemas/client-schema";
import { FormGrid } from "@/app/_components/form-grid";
import type { z } from "zod";

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
      <Card>
        <CardHeader>
          <CardTitle>基本資料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormGrid>
            <div>
              <label htmlFor="name" className={labelClass}>姓名 *</label>
              <Input id="name" type="text" {...register("name")} />
              {errors.name && <p className={errorClass}>{errors.name.message}</p>}
            </div>
            <div>
              <label htmlFor="nameAlt" className={labelClass}>別名</label>
              <Input id="nameAlt" type="text" {...register("nameAlt")} />
            </div>
            <div>
              <label htmlFor="idn" className={labelClass}>身分證字號</label>
              <Input id="idn" type="text" {...register("idn")} />
            </div>
            <SelectField id="sex" label="性別" options={SEX_LABELS} registration={register("sex")} error={errors.sex?.message} />
            <div>
              <label htmlFor="birthday" className={labelClass}>生日</label>
              <Input id="birthday" type="date" {...register("birthday")} />
              {errors.birthday && <p className={errorClass}>{errors.birthday.message}</p>}
            </div>
            <SelectField id="incomeStatus" label="收入狀態" options={INCOME_STATUS_LABELS} registration={register("incomeStatus")} error={errors.incomeStatus?.message} />
            <SelectField id="disabledStatus" label="身障狀態" options={DISABLED_STATUS_LABELS} registration={register("disabledStatus")} error={errors.disabledStatus?.message} />
            <SelectField id="indigenousGroup" label="族別" options={INDIGENOUS_GROUP_LABELS} registration={register("indigenousGroup")} error={errors.indigenousGroup?.message} />
            <div>
              <label htmlFor="tribe" className={labelClass}>部落</label>
              <Input id="tribe" type="text" {...register("tribe")} />
            </div>
            <SelectField id="plainMountain" label="平原/山原" options={PLAIN_MOUNTAIN_LABELS} registration={register("plainMountain")} error={errors.plainMountain?.message} />
            <div className="flex flex-wrap gap-6 sm:col-span-2 lg:col-span-3 pt-2">
              <CheckboxField id="isDead" label="已歿" registration={register("isDead")} />
              <CheckboxField id="householdAdmin" label="戶長" registration={register("householdAdmin")} />
            </div>
          </FormGrid>
        </CardContent>
      </Card>

      {/* 電話資料 */}
      <Card>
        <CardHeader>
          <CardTitle>電話資料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="mb-2">
            <CheckboxField id="canCall" label="可聯繫電話" registration={register("canCall")} />
          </div>
          <FormGrid columns="2">
            <div>
              <label htmlFor="phone" className={labelClass}>電話</label>
              <Input id="phone" type="text" {...register("phone")} />
            </div>
            <div>
              <label htmlFor="phoneNote" className={labelClass}>電話備註</label>
              <Input id="phoneNote" type="text" {...register("phoneNote")} />
            </div>
            <div>
              <label htmlFor="phoneAlt" className={labelClass}>電話（備用）</label>
              <Input id="phoneAlt" type="text" {...register("phoneAlt")} />
            </div>
            <div>
              <label htmlFor="phoneAltNote" className={labelClass}>電話（備用）備註</label>
              <Input id="phoneAltNote" type="text" {...register("phoneAltNote")} />
            </div>
            <div>
              <label htmlFor="mobile" className={labelClass}>手機</label>
              <Input id="mobile" type="text" {...register("mobile")} />
            </div>
            <div>
              <label htmlFor="mobileNote" className={labelClass}>手機備註</label>
              <Input id="mobileNote" type="text" {...register("mobileNote")} />
            </div>
            <div>
              <label htmlFor="mobileAlt" className={labelClass}>手機（備用）</label>
              <Input id="mobileAlt" type="text" {...register("mobileAlt")} />
            </div>
            <div>
              <label htmlFor="mobileAltNote" className={labelClass}>手機（備用）備註</label>
              <Input id="mobileAltNote" type="text" {...register("mobileAltNote")} />
            </div>
          </FormGrid>
        </CardContent>
      </Card>

      {/* 地址資料 */}
      <Card>
        <CardHeader>
          <CardTitle>地址資料</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="mb-2">
            <CheckboxField id="canMail" label="可寄送郵件" registration={register("canMail")} />
          </div>
          <FormGrid>
            <div>
              <label htmlFor="city" className={labelClass}>縣市</label>
              <Input id="city" type="text" {...register("city")} />
            </div>
            <div>
              <label htmlFor="dist" className={labelClass}>區域</label>
              <Input id="dist" type="text" {...register("dist")} />
            </div>
            <div>
              <label htmlFor="vill" className={labelClass}>里</label>
              <Input id="vill" type="text" {...register("vill")} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="addr" className={labelClass}>地址</label>
              <Input id="addr" type="text" {...register("addr")} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="addrNote" className={labelClass}>地址備註</label>
              <Input id="addrNote" type="text" {...register("addrNote")} />
            </div>
          </FormGrid>
        </CardContent>
      </Card>

      {/* 備用地址 */}
      <Card>
        <CardHeader>
          <CardTitle>備用地址</CardTitle>
        </CardHeader>
        <CardContent>
          <FormGrid>
            <div>
              <label htmlFor="cityAlt" className={labelClass}>縣市（備用）</label>
              <Input id="cityAlt" type="text" {...register("cityAlt")} />
            </div>
            <div>
              <label htmlFor="distAlt" className={labelClass}>區域（備用）</label>
              <Input id="distAlt" type="text" {...register("distAlt")} />
            </div>
            <div>
              <label htmlFor="villAlt" className={labelClass}>里（備用）</label>
              <Input id="villAlt" type="text" {...register("villAlt")} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="addrAlt" className={labelClass}>地址（備用）</label>
              <Input id="addrAlt" type="text" {...register("addrAlt")} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="addrAltNote" className={labelClass}>地址（備用）備註</label>
              <Input id="addrAltNote" type="text" {...register("addrAltNote")} />
            </div>
          </FormGrid>
        </CardContent>
      </Card>

      {/* 備註 */}
      <Card>
        <CardHeader>
          <CardTitle>備註</CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <label htmlFor="note" className={labelClass}>備註</label>
            <textarea id="note" rows={4} className={selectClass} {...register("note")} />
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
