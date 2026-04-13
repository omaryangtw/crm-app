import { z } from "zod";

export const exportQuerySchema = z.object({
  isDead: z.boolean().optional(),
  disabledStatus: z.enum(["light", "mid", "heavy", "any"]).optional(),
  incomeStatus: z.enum(["low", "mid_low", "mid_low_elderly", "any"]).optional(),
  canCall: z.boolean().optional(),
  canMail: z.boolean().optional(),
  householdAdmin: z.boolean().optional(),
  sex: z.enum(["male", "female"]).optional(),
  ageMin: z.number().int().optional(),
  ageMax: z.number().int().optional(),
  group: z
    .enum([
      "amis", "atayal", "bunun", "kanakanavu", "kavalan", "paiwan",
      "puyuma", "rukai", "hla_alua", "saisiyat", "sakizaya", "seediq",
      "truku", "thao", "tsou", "yami", "any",
    ])
    .optional(),
  plainMountain: z.enum(["plain", "mountain", "any"]).optional(),
  city: z.string().optional(),
  dist: z.string().optional(),
  name: z.string().optional(),
  nameAlt: z.string().optional(),
  tribe: z.string().optional(),
  vill: z.string().optional(),
  note: z.string().optional(),
});

export const exportCriteriaSchema = z.object({
  query: exportQuerySchema.optional().default({}),
  attributes: z.record(z.string(), z.boolean()).default({}),
  groupBy: z.string().optional(),
  flag: z.string().optional(),
});

export type ExportQuery = z.infer<typeof exportQuerySchema>;
export type ExportCriteria = z.infer<typeof exportCriteriaSchema>;
