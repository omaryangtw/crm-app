// Enum label mappings: enum value → Chinese display label
// Used for rendering UI labels in Traditional Chinese (繁體中文)

export const SEX_LABELS: Record<string, string> = {
  male: "男",
  female: "女",
};

export const INCOME_STATUS_LABELS: Record<string, string> = {
  low: "低收",
  mid_low: "中低收",
  mid_low_elderly: "中低老",
};

export const DISABLED_STATUS_LABELS: Record<string, string> = {
  light: "輕度",
  mid: "中度",
  heavy: "重度",
};

export const INDIGENOUS_GROUP_LABELS: Record<string, string> = {
  amis: "阿美",
  atayal: "泰雅",
  bunun: "布農",
  kanakanavu: "卡那卡那富",
  kavalan: "噶瑪蘭",
  paiwan: "排灣",
  puyuma: "卑南",
  rukai: "魯凱",
  hla_alua: "拉阿魯哇",
  saisiyat: "賽夏",
  sakizaya: "撒奇萊雅",
  seediq: "賽德克",
  truku: "太魯閣",
  thao: "邵",
  tsou: "鄒",
  yami: "雅美",
};

export const PLAIN_MOUNTAIN_LABELS: Record<string, string> = {
  plain: "平原",
  mountain: "山原",
};

export const CASE_STATUS_LABELS: Record<string, string> = {
  in_progress: "處理中",
  closed: "結案",
};

export const CASE_TYPE_MAJOR_LABELS: Record<string, string> = {
  general: "一般",
  legal: "法律",
  emergency: "急難救助",
};

export const CASE_TYPE_MINOR_LABELS: Record<string, string> = {
  general_minor: "一般",
  job_seeking: "求職",
  petition: "陳情",
  policy_suggestion: "施政建議",
  debt: "債務",
  labor_dispute: "勞資",
  traffic_accident: "車禍",
  family_affair: "家事",
  inheritance: "繼承",
  criminal: "刑事",
  consultation: "諮詢",
  non_litigation: "非訟",
  living_assistance: "生活扶助",
  death_relief: "死亡救助",
  emergency_relief: "急難紓困",
  major_disaster: "重大災害",
  medical_subsidy: "醫療補助",
};

export const CONTACT_TYPE_LABELS: Record<string, string> = {
  outgoing: "撥出",
  incoming: "來電",
  visit: "親訪",
  sms: "簡訊",
};

export const USER_ROLE_LABELS: Record<string, string> = {
  admin: "管理員",
  user: "使用者",
};
