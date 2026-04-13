"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { auth } from "../auth";
import { clientCreateSchema, clientUpdateSchema } from "../schemas/client-schema";
import { sanitizeObject } from "../utils/sanitize";
import type { ActionResult } from "./auth-actions";
import { createAuditLogEntry, serializeEntity } from "../audit/audit-service";

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

  let client: Awaited<ReturnType<typeof prisma.client.create>> | null = null;
  try {
    client = await prisma.client.create({ data: sanitized });
    revalidatePath("/clients");
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return { success: false, error: "此資料已存在" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }

  try {
    const userId = parseInt(session.user?.id ?? "0", 10);
    const userEmail = session.user?.email ?? "";
    await createAuditLogEntry({
      entityType: "Client",
      entityId: client.id,
      action: "CREATE",
      userId,
      userEmail,
      oldData: null,
      newData: serializeEntity(client as unknown as Record<string, unknown>),
      changedFields: [],
    });
  } catch {
    // Audit failure must not affect CRUD result
  }

  return { success: true, data: { id: client.id } };
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

  // Fetch old record before mutation for audit snapshot
  const oldRecord = await prisma.client.findUnique({ where: { id } });

  let client: Awaited<ReturnType<typeof prisma.client.update>> | null = null;
  try {
    client = await prisma.client.update({
      where: { id },
      data: sanitized,
    });
    revalidatePath("/clients");
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") return { success: false, error: "此資料已存在" };
      if (err.code === "P2025") return { success: false, error: "找不到資料" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }

  try {
    const userId = parseInt(session.user?.id ?? "0", 10);
    const userEmail = session.user?.email ?? "";
    const oldData = oldRecord
      ? serializeEntity(oldRecord as unknown as Record<string, unknown>)
      : null;
    const newData = serializeEntity(client as unknown as Record<string, unknown>);
    await createAuditLogEntry({
      entityType: "Client",
      entityId: client.id,
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

  return { success: true, data: { id: client.id } };
}

export async function deleteClient(
  id: number
): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  // Fetch old record before deletion for audit snapshot
  const oldRecord = await prisma.client.findUnique({ where: { id } });

  try {
    await prisma.client.delete({ where: { id } });
    revalidatePath("/clients");
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
      entityType: "Client",
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
