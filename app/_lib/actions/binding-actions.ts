"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { auth } from "../auth";

export interface BindingActionResult {
  success: boolean;
  error?: string;
}

async function requireAdmin(): Promise<BindingActionResult | null> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };
  if (session.user.role !== "admin") return { success: false, error: "權限不足" };
  return null;
}

export async function bindStaffUser(
  staffId: number,
  userId: number
): Promise<BindingActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  // Check the User is not already bound to another Staff
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { staffId: true },
  });
  if (user?.staffId !== null && user?.staffId !== undefined) {
    return { success: false, error: "此帳號已連結其他員工" };
  }

  // Check the Staff is not already bound by another User
  const existingBinding = await prisma.user.findUnique({
    where: { staffId },
    select: { id: true },
  });
  if (existingBinding) {
    return { success: false, error: "此員工已被其他帳號連結" };
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { staffId },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { success: false, error: "此員工已被其他帳號連結" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }

  revalidatePath("/staff", "layout");
  return { success: true };
}

export async function unbindStaffUser(
  staffId: number
): Promise<BindingActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const boundUser = await prisma.user.findUnique({
    where: { staffId },
    select: { id: true },
  });
  if (!boundUser) {
    return { success: false, error: "此員工尚未連結帳號" };
  }

  await prisma.user.update({
    where: { id: boundUser.id },
    data: { staffId: null },
  });

  revalidatePath("/staff", "layout");
  return { success: true };
}

export async function getUnboundUsers(): Promise<
  { id: number; email: string }[]
> {
  return prisma.user.findMany({
    where: { staffId: null },
    select: { id: true, email: true },
    orderBy: { email: "asc" },
  });
}

export interface AutoBindResult {
  success: boolean;
  bound: number;
  skipped: number;
  error?: string;
}

export async function getAutoBindCandidates(): Promise<
  { staffId: number; staffName: string; userId: number; userEmail: string }[]
> {
  // Find Staff records with a non-null email that are NOT already bound by any User
  const unboundStaff = await prisma.staff.findMany({
    where: {
      email: { not: null },
      user: null, // no User has staffId pointing to this Staff
    },
    select: { id: true, name: true, email: true },
  });

  const candidates: {
    staffId: number;
    staffName: string;
    userId: number;
    userEmail: string;
  }[] = [];

  for (const staff of unboundStaff) {
    // Find a User with matching email AND not already bound to any Staff
    const matchingUser = await prisma.user.findFirst({
      where: {
        email: staff.email!,
        staffId: null,
      },
      select: { id: true, email: true },
    });

    if (matchingUser) {
      candidates.push({
        staffId: staff.id,
        staffName: staff.name,
        userId: matchingUser.id,
        userEmail: matchingUser.email,
      });
    }
  }

  return candidates;
}

export async function autoBindByEmail(): Promise<AutoBindResult> {
  const denied = await requireAdmin();
  if (denied) return { success: false, bound: 0, skipped: 0, error: denied.error };

  const candidates = await getAutoBindCandidates();

  let bound = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    try {
      await prisma.user.update({
        where: { id: candidate.userId },
        data: { staffId: candidate.staffId },
      });
      bound++;
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        // Unique constraint violation — already bound by the time we process
        skipped++;
      } else {
        skipped++;
      }
    }
  }

  revalidatePath("/staff", "layout");
  return { success: true, bound, skipped };
}


// ── Password Reset (admin only) ──

/**
 * Reset a user's password. Sets password to empty string sentinel.
 * On next login, whatever password the user types becomes their new password.
 */
export async function resetUserPassword(
  userId: number,
): Promise<BindingActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) return { success: false, error: "找不到此帳號" };

  await prisma.user.update({
    where: { id: userId },
    data: { password: "" },
  });

  return { success: true };
}

// ── Role Management (admin only) ──

/**
 * Update a user's role (admin / user).
 */
export async function updateUserRole(
  userId: number,
  role: "admin" | "user",
): Promise<BindingActionResult> {
  const denied = await requireAdmin();
  if (denied) return denied;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) return { success: false, error: "找不到此帳號" };

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  revalidatePath("/staff", "layout");
  return { success: true };
}
