"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { auth } from "../auth";
import { todoCreateSchema, todoUpdateSchema } from "../schemas/todo-schema";
import { sanitizeObject } from "../utils/sanitize";
import type { ActionResult } from "./auth-actions";
import { format } from "date-fns";
import { formatCompletionMessage } from "../utils/todo-utils";

export async function createTodo(
  formData: FormData
): Promise<ActionResult<{ id: number }>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  const raw = Object.fromEntries(formData);
  const parsed = todoCreateSchema.safeParse({
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

  // Default staffInChargeIds to [session.user.staffId] if empty and staffId exists
  let ids = staffInChargeIds ?? [];
  if (ids.length === 0 && session.user.staffId) {
    ids = [session.user.staffId];
  }

  try {
    const todo = await prisma.todo.create({
      data: {
        ...sanitized,
        ...(clientId ? { clientId } : { clientId: null }),
        staffInCharge: {
          connect: ids.map((id) => ({ id })),
        },
      },
    });
    revalidatePath("/");
    return { success: true, data: { id: todo.id } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return { success: false, error: "指定的承辦人不存在" };
      }
      if (err.code === "P2003")
        return { success: false, error: "關聯資料不存在" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

export async function updateTodo(
  id: number,
  formData: FormData
): Promise<ActionResult<{ id: number }>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  const raw = Object.fromEntries(formData);
  const parsed = todoUpdateSchema.safeParse({
    ...raw,
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
    const todo = await prisma.todo.update({
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
    revalidatePath("/");
    return { success: true, data: { id: todo.id } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") return { success: false, error: "找不到資料" };
      if (err.code === "P2003") {
        return { success: false, error: "關聯資料不存在" };
      }
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

export async function completeTodo(
  id: number
): Promise<ActionResult<{ id: number }>> {
  const session = await auth();
  if (!session?.user?.email) return { success: false, error: "請先登入" };

  try {
    // 1. Fetch the todo with its note and clientId
    const todo = await prisma.todo.findUnique({
      where: { id },
      select: { note: true, clientId: true, done: true, staffInCharge: { select: { id: true } } },
    });
    if (!todo) return { success: false, error: "找不到資料" };
    if (todo.done) return { success: false, error: "此待辦已完成" };

    // 2. Get current user email from session
    const userEmail = session.user.email;

    // 3. Format today's date as YYYY-MM-DD
    const today = format(new Date(), "yyyy-MM-dd");

    // 4. Build the contact record message
    const message = formatCompletionMessage(
      today,
      userEmail,
      todo.note ?? ""
    );

    // 5. Mark todo done, and create contact record if todo has a client
    if (todo.clientId) {
      const [, updatedTodo] = await prisma.$transaction([
        prisma.contact.create({
          data: {
            date: new Date(),
            record: message,
            clientId: todo.clientId,
            isSuccess: true,
            staffInCharge: {
              connect: todo.staffInCharge.map((s) => ({ id: s.id })),
            },
          },
        }),
        prisma.todo.update({
          where: { id },
          data: { done: true },
        }),
      ]);

      revalidatePath("/");
      revalidatePath(`/clients/${todo.clientId}`);
      return { success: true, data: { id: updatedTodo.id } };
    } else {
      const updatedTodo = await prisma.todo.update({
        where: { id },
        data: { done: true },
      });

      revalidatePath("/");
      return { success: true, data: { id: updatedTodo.id } };
    }
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") return { success: false, error: "找不到資料" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}

export async function deleteTodo(
  id: number
): Promise<ActionResult<null>> {
  const session = await auth();
  if (!session) return { success: false, error: "請先登入" };

  try {
    await prisma.todo.delete({ where: { id } });
    revalidatePath("/");
    return { success: true, data: null };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") return { success: false, error: "找不到資料" };
    }
    return { success: false, error: "系統錯誤，請稍後再試" };
  }
}
