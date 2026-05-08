import { z } from "zod";

// Helper: convert empty string to undefined (for optional select fields)
const optionalEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.enum(values).optional(),
  );

// Helper: convert empty string to null (for optional text fields)
const optionalDate = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.date().optional().nullable(),
);

export const clientCreateSchema = z.object({
  name: z.string().min(1, "姓名為必填").max(100),
  nameAlt: z.string().max(100).optional().nullable(),
  idn: z.string().max(20).optional().nullable(),
  sex: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.enum(["male", "female"], { message: "性別為必填" }),
  ),
  birthday: optionalDate,
  isDead: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()).default(false),
  householdAdmin: z.preprocess((v) => v === "true" || v === "on" || v === true, z.boolean()).default(false),
  incomeStatus: optionalEnum(["low", "mid_low", "mid_low_elderly"]),
  disabledStatus: optionalEnum(["light", "mid", "heavy"]),
  indigenousGroup: optionalEnum([
    "amis", "atayal", "bunun", "kanakanavu", "kavalan", "paiwan",
    "puyuma", "rukai", "hla_alua", "saisiyat", "sakizaya", "seediq",
    "truku", "thao", "tsou", "yami",
  ]),
  tribe: z.string().max(100).optional().nullable(),
  plainMountain: optionalEnum(["plain", "mountain"]),
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
