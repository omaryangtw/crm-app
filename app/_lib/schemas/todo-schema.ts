import { z } from "zod";
import { coerceStaffInChargeIds } from "./contact-schema";

export const todoCreateSchema = z.object({
  date: z.coerce.date().optional().nullable(),
  note: z.string().optional().nullable(),
  clientId: z.number().int().optional().nullable(),
  staffInChargeIds: coerceStaffInChargeIds,
});

export const todoUpdateSchema = z.object({
  date: z.coerce.date().optional().nullable(),
  note: z.string().optional().nullable(),
  staffInChargeIds: coerceStaffInChargeIds,
});

export type TodoCreateInput = z.infer<typeof todoCreateSchema>;
export type TodoUpdateInput = z.infer<typeof todoUpdateSchema>;
