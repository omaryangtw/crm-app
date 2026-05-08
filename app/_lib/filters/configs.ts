import {
  SEX_LABELS,
  INDIGENOUS_GROUP_LABELS,
  PLAIN_MOUNTAIN_LABELS,
  CASE_STATUS_LABELS,
  CASE_TYPE_MAJOR_LABELS,
  CONTACT_TYPE_LABELS,
} from "@/app/_lib/constants/enums";
import type { FilterConfig } from "./filter-config";

export const clientFilterConfig: FilterConfig = [
  { type: "enum", field: "sex", label: "性別", options: SEX_LABELS },
  { type: "enum", field: "indigenousGroup", label: "族別", options: INDIGENOUS_GROUP_LABELS },
  { type: "enum", field: "plainMountain", label: "平/山", options: PLAIN_MOUNTAIN_LABELS },
  { type: "boolean", field: "isDead", label: "已歿", trueLabel: "已歿", falseLabel: "存活" },
];

export const caseFilterConfig: FilterConfig = [
  { type: "enum", field: "status", label: "狀態", options: CASE_STATUS_LABELS },
  { type: "enum", field: "typesMajor", label: "類型", options: CASE_TYPE_MAJOR_LABELS },
  { type: "relation", field: "staffInCharge", label: "承辦人" },
];

export const contactFilterConfig: FilterConfig = [
  { type: "dateRange", field: "date", label: "日期" },
  { type: "enum", field: "contactType", label: "類型", options: CONTACT_TYPE_LABELS },
  { type: "boolean", field: "isSuccess", label: "成功", trueLabel: "成功", falseLabel: "失敗" },
  { type: "relation", field: "staffInCharge", label: "承辦人" },
];
