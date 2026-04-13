import { z } from "zod";

export const todoCreateSchema = z.object({
  date: z.coerce.date().optional().nullable(),
  note: z.string().optional().nullable(),
  clientId: z.number().int("待辦事項必須關聯族人"),
});

export type TodoCreateInput = z.infer<typeof todoCreateSchema>;
