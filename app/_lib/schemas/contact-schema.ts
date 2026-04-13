import { z } from "zod";

/**
 * Coerce a FormData comma-separated string value to an array of integers.
 * Empty string / whitespace → [], otherwise split and parse each as integer.
 */
const coerceStaffInChargeIds = z
  .union([z.array(z.number().int()), z.string(), z.null()])
  .optional()
  .transform((val): number[] => {
    if (val === null || val === undefined) return [];
    if (Array.isArray(val)) return val;
    const trimmed = val.trim();
    if (trimmed === "") return [];
    return trimmed
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "")
      .map(Number)
      .filter((n) => Number.isInteger(n) && !Number.isNaN(n));
  });

export const contactCreateSchema = z.object({
  date: z.coerce.date().optional().nullable(),
  contactType: z.enum(["outgoing", "incoming", "visit", "sms"]).optional().nullable(),
  isSuccess: z.boolean().default(true),
  record: z.string().optional().nullable(),
  staffInChargeIds: coerceStaffInChargeIds,
  clientId: z.number().int("通聯紀錄必須關聯族人"),
});

export type ContactCreateInput = z.infer<typeof contactCreateSchema>;
