/** Enum filter — options come from a static label map */
export interface EnumFilterField {
  type: "enum";
  field: string; // Prisma model field name, e.g. "sex"
  label: string; // Chinese display label, e.g. "性別"
  options: Record<string, string>; // value → Chinese label map (from enums.ts)
}

/** Relation filter — options loaded async from DB */
export interface RelationFilterField {
  type: "relation";
  field: string; // logical field name, e.g. "staffInCharge"
  label: string; // e.g. "承辦人"
}

/** Boolean filter — exactly two options */
export interface BooleanFilterField {
  type: "boolean";
  field: string; // e.g. "isSuccess"
  label: string; // e.g. "成功"
  trueLabel: string; // e.g. "成功"
  falseLabel: string; // e.g. "失敗"
}

/** Date range filter — from..to date picker */
export interface DateRangeFilterField {
  type: "dateRange";
  field: string; // Prisma model field name, e.g. "date"
  label: string; // e.g. "日期"
}

export type FilterFieldConfig =
  | EnumFilterField
  | RelationFilterField
  | BooleanFilterField
  | DateRangeFilterField;

/** Per-page filter configuration (serializable — no functions) */
export type FilterConfig = FilterFieldConfig[];

/** A single active filter */
export interface ActiveFilter {
  field: string; // matches FilterFieldConfig.field
  value: string; // serialized value (enum key, staff id, "true"/"false", "YYYY-MM-DD..YYYY-MM-DD")
}
