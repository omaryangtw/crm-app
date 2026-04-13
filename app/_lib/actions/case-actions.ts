"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { auth } from "../auth";
import { caseCreateSchema, caseUpdateSchema } from "../schemas/case-schema";
import { sanitizeObject } from "../utils/sanitize";
import type { ActionResult } from "./auth-actions";

export async function createCase(
  formData: FormData
): Promise<ActionResult<{ id: number }>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  const raw = Object.fromEntries(formData);
  const parsed = caseCreateSchema.safeParse({
    ...raw,
    clientId: raw.clientId ? Number(raw.clientId) : undefined,
    staffInChargeIds: raw.staffInChargeIds ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.entries(fieldErrors)[0];
    return {
      success: false,
      error: `${firstError?.[0]}: ${firstError?.[1]?.[0]}`,
    };
  }

  const { clientId, staffInChargeIds, ...rest } = parsed.data;
  const sanitized = sanitizeObject(rest as Record<string, unknown>);

  try {
    const caseRecord = await prisma.case.create({
      data: {
        ...sanitized,
        clientId,
        staffInCharge: {
          connect: (staffInChargeIds ?? []).map((id) => ({ id })),
        },
      },
    });
    revalidatePath("/cases");
    return { success: true, data: { id: caseRecord.id } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return { success: false, error: "此資料已存在" };
      if (err.code === "P2025") {
        return { success: false, error: "指定的承辦人不存在" };
      }
      if (err.code === "P2003") {
        return { success: false, error: "關聯資料不存在" };
      }
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

export async function updateCase(
  id: number,
  formData: FormData
): Promise<ActionResult<{ id: number }>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  const raw = Object.fromEntries(formData);
  const parsed = caseUpdateSchema.safeParse({
    ...raw,
    clientId: raw.clientId ? Number(raw.clientId) : undefined,
    staffInChargeIds: raw.staffInChargeIds ?? undefined,
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.entries(fieldErrors)[0];
    return {
      success: false,
      error: `${firstError?.[0]}: ${firstError?.[1]?.[0]}`,
    };
  }

  const { staffInChargeIds, ...rest } = parsed.data;
  const sanitized = sanitizeObject(rest as Record<string, unknown>);

  try {
    const caseRecord = await prisma.case.update({
      where: { id },
      data: {
        ...sanitized,
        ...(staffInChargeIds !== undefined
          ? {
              staffInCharge: {
                set: staffInChargeIds.map((sid) => ({ id: sid })),
              },
            }
          : {}),
      },
    });
    revalidatePath("/cases");
    return { success: true, data: { id: caseRecord.id } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return { success: false, error: "此資料已存在" };
      if (err.code === "P2025") return { success: false, error: "找不到資料" };
      if (err.code === "P2003") {
        return { success: false, error: "關聯資料不存在" };
      }
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

export async function deleteCase(
  id: number
): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  try {
    await prisma.case.delete({ where: { id } });
    revalidatePath("/cases");
    return { success: true, data: null };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") return { success: false, error: "找不到資料" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}
