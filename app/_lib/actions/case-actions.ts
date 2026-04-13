"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { auth } from "../auth";
import { caseCreateSchema, caseUpdateSchema } from "../schemas/case-schema";
import { sanitizeObject } from "../utils/sanitize";
import type { ActionResult } from "./auth-actions";
import { createAuditLogEntry, serializeEntity } from "../audit/audit-service";

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

  let caseRecord: Awaited<ReturnType<typeof prisma.case.create>> | null = null;
  try {
    caseRecord = await prisma.case.create({
      data: {
        ...sanitized,
        clientId,
        staffInCharge: {
          connect: (staffInChargeIds ?? []).map((id) => ({ id })),
        },
      },
    });
    revalidatePath("/cases");
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

  try {
    const userId = parseInt(session.user?.id ?? "0", 10);
    const userEmail = session.user?.email ?? "";
    await createAuditLogEntry({
      entityType: "Case",
      entityId: caseRecord.id,
      action: "CREATE",
      userId,
      userEmail,
      oldData: null,
      newData: serializeEntity(caseRecord as unknown as Record<string, unknown>),
      changedFields: [],
    });
  } catch {
    // Audit failure must not affect CRUD result
  }

  return { success: true, data: { id: caseRecord.id } };
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

  // Fetch old record before mutation for audit snapshot
  const oldRecord = await prisma.case.findUnique({ where: { id } });

  let caseRecord: Awaited<ReturnType<typeof prisma.case.update>> | null = null;
  try {
    caseRecord = await prisma.case.update({
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

  try {
    const userId = parseInt(session.user?.id ?? "0", 10);
    const userEmail = session.user?.email ?? "";
    const oldData = oldRecord
      ? serializeEntity(oldRecord as unknown as Record<string, unknown>)
      : null;
    const newData = serializeEntity(caseRecord as unknown as Record<string, unknown>);
    await createAuditLogEntry({
      entityType: "Case",
      entityId: caseRecord.id,
      action: "UPDATE",
      userId,
      userEmail,
      oldData,
      newData,
      changedFields: [],
    });
  } catch {
    // Audit failure must not affect CRUD result
  }

  return { success: true, data: { id: caseRecord.id } };
}

export async function deleteCase(
  id: number
): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  // Fetch old record before deletion for audit snapshot
  const oldRecord = await prisma.case.findUnique({ where: { id } });

  try {
    await prisma.case.delete({ where: { id } });
    revalidatePath("/cases");
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") return { success: false, error: "找不到資料" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }

  try {
    const userId = parseInt(session.user?.id ?? "0", 10);
    const userEmail = session.user?.email ?? "";
    await createAuditLogEntry({
      entityType: "Case",
      entityId: id,
      action: "DELETE",
      userId,
      userEmail,
      oldData: oldRecord
        ? serializeEntity(oldRecord as unknown as Record<string, unknown>)
        : null,
      newData: null,
      changedFields: [],
    });
  } catch {
    // Audit failure must not affect CRUD result
  }

  return { success: true, data: null };
}
