"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { auth } from "../auth";
import { contactCreateSchema } from "../schemas/contact-schema";
import { sanitizeObject } from "../utils/sanitize";
import type { ActionResult } from "./auth-actions";
import { createAuditLogEntry, serializeEntity } from "../audit/audit-service";
import { requestDeletion } from "./deletion-actions";

export async function createContact(
  formData: FormData
): Promise<ActionResult<{ id: number }>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  const raw = Object.fromEntries(formData);
  const parsed = contactCreateSchema.safeParse({
    ...raw,
    clientId: raw.clientId ? Number(raw.clientId) : undefined,
    caseId: raw.caseId ? Number(raw.caseId) : undefined,
    staffInChargeIds: raw.staffInChargeIds ?? undefined,
    isSuccess: raw.isSuccess === "true" || raw.isSuccess === "on" ? true : raw.isSuccess === "false" ? false : true,
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.entries(fieldErrors)[0];
    return {
      success: false,
      error: `${firstError?.[0]}: ${firstError?.[1]?.[0]}`,
    };
  }

  const { clientId, staffInChargeIds, caseId, ...rest } = parsed.data;

  // Validate caseId points to an existing Case
  if (caseId) {
    const caseExists = await prisma.case.findUnique({
      where: { id: caseId },
      select: { id: true },
    });
    if (!caseExists) {
      return { success: false, error: "指定的案件不存在" };
    }
  }

  const sanitized = sanitizeObject(rest as Record<string, unknown>);

  let contact: Awaited<ReturnType<typeof prisma.contact.create>> | null = null;
  try {
    contact = await prisma.contact.create({
      data: {
        ...sanitized,
        clientId,
        caseId: caseId ?? null,
        staffInCharge: {
          connect: (staffInChargeIds ?? []).map((id) => ({ id })),
        },
      },
    });
    revalidatePath("/contacts");
    revalidatePath(`/clients/${clientId}`);
    if (caseId) {
      revalidatePath(`/cases/${caseId}`);
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
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
      entityType: "Contact",
      entityId: contact.id,
      action: "CREATE",
      userId,
      userEmail,
      oldData: null,
      newData: serializeEntity(contact as unknown as Record<string, unknown>),
      changedFields: [],
    });
  } catch {
    // Audit failure must not affect CRUD result
  }

  return { success: true, data: { id: contact.id } };
}

export async function deleteContact(
  id: number,
  clientId?: number
): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  const result = await requestDeletion({
    entityType: "Contact",
    entityId: id,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  if (clientId) {
    revalidatePath(`/clients/${clientId}`);
  }

  return { success: true, data: null };
}

export async function markContactUnsuccessful(
  id: number
): Promise<ActionResult<{ id: number }>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  // Fetch old record before mutation for audit snapshot
  const oldRecord = await prisma.contact.findUnique({ where: { id } });

  let contact: Awaited<ReturnType<typeof prisma.contact.update>> | null = null;
  try {
    contact = await prisma.contact.update({
      where: { id },
      data: { isSuccess: false },
    });
    revalidatePath("/contacts");
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
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
    const newData = serializeEntity(contact as unknown as Record<string, unknown>);
    await createAuditLogEntry({
      entityType: "Contact",
      entityId: contact.id,
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

  return { success: true, data: { id: contact.id } };
}
