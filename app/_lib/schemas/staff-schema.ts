import { z } from "zod";

export const staffCreateSchema = z.object({
  name: z.string().trim().min(1, { error: "姓名為必填" }),
  aliases: z.array(z.string().trim()).optional().default([]),
  email: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().email({ error: "電子郵件格式不正確" }).nullable()),
  phone: z.string().trim().optional().nullable(),
});

export const staffUpdateSchema = staffCreateSchema.partial().required({ name: true });

export type StaffCreateInput = z.infer<typeof staffCreateSchema>;
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;
