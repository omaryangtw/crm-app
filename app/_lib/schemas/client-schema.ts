import { z } from "zod";

export const clientCreateSchema = z.object({
  name: z.string().min(1, "姓名為必填").max(100),
  nameAlt: z.string().max(100).optional().nullable(),
  idn: z.string().max(20).optional().nullable(),
  sex: z.enum(["male", "female"], { message: "性別為必填" }),
  birthday: z.coerce.date().optional().nullable(),
  isDead: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()).default(false),
  householdAdmin: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()).default(false),
  incomeStatus: z.enum(["low", "mid_low", "mid_low_elderly"]).optional().nullable(),
  disabledStatus: z.enum(["light", "mid", "heavy"]).optional().nullable(),
  indigenousGroup: z
    .enum([
      "amis", "atayal", "bunun", "kanakanavu", "kavalan", "paiwan",
      "puyuma", "rukai", "hla_alua", "saisiyat", "sakizaya", "seediq",
      "truku", "thao", "tsou", "yami",
    ])
    .optional()
    .nullable(),
  tribe: z.string().max(100).optional().nullable(),
  plainMountain: z.enum(["plain", "mountain"]).optional().nullable(),
  canCall: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()).default(true),
  phone: z.string().max(20).optional().nullable(),
  phoneNote: z.string().max(200).optional().nullable(),
  phoneAlt: z.string().max(20).optional().nullable(),
  phoneAltNote: z.string().max(200).optional().nullable(),
  mobile: z.string().min(1, "手機為必填").max(20),
  mobileNote: z.string().max(200).optional().nullable(),
  mobileAlt: z.string().max(20).optional().nullable(),
  mobileAltNote: z.string().max(200).optional().nullable(),
  canMail: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()).default(true),
  city: z.string().max(50).optional().nullable(),
  cityAlt: z.string().max(50).optional().nullable(),
  dist: z.string().max(50).optional().nullable(),
  distAlt: z.string().max(50).optional().nullable(),
  vill: z.string().max(50).optional().nullable(),
  villAlt: z.string().max(50).optional().nullable(),
  addr: z.string().max(200).optional().nullable(),
  addrAlt: z.string().max(200).optional().nullable(),
  addrNote: z.string().max(200).optional().nullable(),
  addrAltNote: z.string().max(200).optional().nullable(),
  note: z.string().optional().nullable(),
});

export const clientUpdateSchema = clientCreateSchema.partial();

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;
