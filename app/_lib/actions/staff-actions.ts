"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { auth } from "../auth";
import { staffCreateSchema, staffUpdateSchema } from "../schemas/staff-schema";
import { sanitizeObject } from "../utils/sanitize";
import type { ActionResult } from "./auth-actions";

export async function createStaff(
  formData: FormData
): Promise<ActionResult<{ id: number }>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  const raw = Object.fromEntries(formData);
  // Parse aliases from JSON string to array
  const aliasesRaw = raw.aliases;
  const aliasesArr =
    typeof aliasesRaw === "string" ? (() => { try { return JSON.parse(aliasesRaw); } catch { return []; } })() : [];
  const parsed = staffCreateSchema.safeParse({ ...raw, aliases: aliasesArr });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.entries(fieldErrors)[0];
    return {
      success: false,
      error: `${firstError?.[0]}: ${firstError?.[1]?.[0]}`,
    };
  }

  const sanitized = sanitizeObject(
    parsed.data as Record<string, unknown>
  ) as Prisma.StaffCreateInput;

  try {
    const staff = await prisma.staff.create({ data: sanitized });
    revalidatePath("/staff");
    return { success: true, data: { id: staff.id } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002")
        return { success: false, error: "此電子郵件已被使用" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

export async function updateStaff(
  id: number,
  formData: FormData
): Promise<ActionResult<{ id: number }>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  const raw = Object.fromEntries(formData);
  // Parse aliases from JSON string to array
  const aliasesRaw = raw.aliases;
  const aliasesArr =
    typeof aliasesRaw === "string" ? (() => { try { return JSON.parse(aliasesRaw); } catch { return []; } })() : [];
  const parsed = staffUpdateSchema.safeParse({ ...raw, aliases: aliasesArr });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.entries(fieldErrors)[0];
    return {
      success: false,
      error: `${firstError?.[0]}: ${firstError?.[1]?.[0]}`,
    };
  }

  const sanitized = sanitizeObject(
    parsed.data as Record<string, unknown>
  ) as Prisma.StaffUpdateInput;

  try {
    const staff = await prisma.staff.update({
      where: { id },
      data: sanitized,
    });
    revalidatePath("/staff");
    return { success: true, data: { id: staff.id } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002")
        return { success: false, error: "此電子郵件已被使用" };
      if (err.code === "P2025")
        return { success: false, error: "找不到員工資料" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

export async function deactivateStaff(
  id: number
): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  try {
    await prisma.staff.update({
      where: { id },
      data: { isActive: false },
    });
    revalidatePath("/staff");
    return { success: true, data: null };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025")
        return { success: false, error: "找不到員工資料" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

export async function activateStaff(
  id: number
): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  try {
    await prisma.staff.update({
      where: { id },
      data: { isActive: true },
    });
    revalidatePath("/staff");
    return { success: true, data: null };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025")
        return { success: false, error: "找不到員工資料" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

export async function getActiveStaff(): Promise<{ id: number; name: string; aliases: string[] }[]> {
  const session = await auth();
  if (!session) return [];

  return prisma.staff.findMany({
    where: { isActive: true },
    select: { id: true, name: true, aliases: true },
    orderBy: { name: "asc" },
  });
}

export async function getStaffList(search?: string) {
  const session = await auth();
  if (!session) return [];

  const where: Prisma.StaffWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { aliases: { has: search } },
        ],
      }
    : {};

  return prisma.staff.findMany({
    where,
    orderBy: { name: "asc" },
  });
}

export async function getStaffById(id: number) {
  const session = await auth();
  if (!session) return null;

  return prisma.staff.findUnique({ where: { id } });
}
