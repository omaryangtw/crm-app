"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { auth } from "../auth";
import { todoCreateSchema } from "../schemas/todo-schema";
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
  });
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.entries(fieldErrors)[0];
    return {
      success: false,
      error: `${firstError?.[0]}: ${firstError?.[1]?.[0]}`,
    };
  }

  const { clientId, ...rest } = parsed.data;
  const sanitized = sanitizeObject(rest as Record<string, unknown>);

  try {
    const todo = await prisma.todo.create({
      data: { ...sanitized, clientId },
    });
    revalidatePath("/");
    return { success: true, data: { id: todo.id } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2003")
        return { success: false, error: "關聯資料不存在" };
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
      select: { note: true, clientId: true, done: true },
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

    // 5. Create contact record and mark todo done in a transaction
    const [, updatedTodo] = await prisma.$transaction([
      prisma.contact.create({
        data: {
          date: new Date(),
          record: message,
          clientId: todo.clientId,
          isSuccess: true,
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
