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

export const caseCreateSchema = z.object({
  name: z.string().optional().nullable(),
  status: z.enum(["in_progress", "closed"]).optional().nullable(),
  staffInChargeIds: coerceStaffInChargeIds,
  typesMajor: z.enum(["general", "legal", "emergency"]).optional().nullable(),
  typesMinor: z
    .enum([
      "general_minor", "job_seeking", "petition", "policy_suggestion",
      "debt", "labor_dispute", "traffic_accident", "family_affair",
      "inheritance", "criminal", "consultation", "non_litigation",
      "living_assistance", "death_relief", "emergency_relief",
      "major_disaster", "medical_subsidy",
    ])
    .optional()
    .nullable(),
  relation1: z.string().optional().nullable(),
  relation2: z.string().optional().nullable(),
  relation3: z.string().optional().nullable(),
  contact1: z.string().optional().nullable(),
  contact2: z.string().optional().nullable(),
  contact3: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  handle: z.string().optional().nullable(),
  clientId: z.number().int("案件必須關聯族人"),
});

export const caseUpdateSchema = caseCreateSchema.partial();

export type CaseCreateInput = z.infer<typeof caseCreateSchema>;
export type CaseUpdateInput = z.infer<typeof caseUpdateSchema>;
