import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("請輸入有效的電子郵件"),
  password: z
    .string()
    .min(8, "密碼長度需介於 8-16 字元")
    .max(16, "密碼長度需介於 8-16 字元")
    .regex(/^[a-zA-Z0-9]+$/, "密碼僅允許英文字母與數字"),
});

export const loginSchema = z.object({
  email: z.string().email("請輸入有效的電子郵件"),
  password: z.string().min(1, "請輸入密碼"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
