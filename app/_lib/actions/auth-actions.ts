"use server";

import bcrypt from "bcrypt";
import { prisma } from "../db";
import { registerSchema } from "../schemas/auth-schema";

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function registerUser(
  formData: FormData
): Promise<ActionResult<{ id: number; email: string }>> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.entries(fieldErrors)[0];
    return {
      success: false,
      error: `${firstError?.[0]}: ${firstError?.[1]?.[0]}`,
    };
  }

  const { email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "此帳號已被使用" };
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, password: hashedPassword },
  });

  return { success: true, data: { id: user.id, email: user.email } };
}
