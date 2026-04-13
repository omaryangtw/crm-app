"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { auth } from "../auth";
import { clientCreateSchema, clientUpdateSchema } from "../schemas/client-schema";
import { sanitizeObject } from "../utils/sanitize";
import type { ActionResult } from "./auth-actions";

export async function createClient(
  formData: FormData
): Promise<ActionResult<{ id: number }>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  const raw = Object.fromEntries(formData);
  const parsed = clientCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.entries(fieldErrors)[0];
    return {
      success: false,
      error: `${firstError?.[0]}: ${firstError?.[1]?.[0]}`,
    };
  }

  const sanitized = sanitizeObject(parsed.data as Record<string, unknown>);

  try {
    const client = await prisma.client.create({ data: sanitized });
    revalidatePath("/clients");
    return { success: true, data: { id: client.id } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return { success: false, error: "此資料已存在" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

export async function updateClient(
  id: number,
  formData: FormData
): Promise<ActionResult<{ id: number }>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  const raw = Object.fromEntries(formData);
  const parsed = clientUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.entries(fieldErrors)[0];
    return {
      success: false,
      error: `${firstError?.[0]}: ${firstError?.[1]?.[0]}`,
    };
  }

  const sanitized = sanitizeObject(parsed.data as Record<string, unknown>);

  try {
    const client = await prisma.client.update({
      where: { id },
      data: sanitized,
    });
    revalidatePath("/clients");
    return { success: true, data: { id: client.id } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return { success: false, error: "此資料已存在" };
      if (err.code === "P2025") return { success: false, error: "找不到資料" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

export async function deleteClient(
  id: number
): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  try {
    await prisma.client.delete({ where: { id } });
    revalidatePath("/clients");
    return { success: true, data: null };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") return { success: false, error: "找不到資料" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}
