// Data-driven relationship inverse map
// Replaces the legacy 140+ line switch-case with a simple lookup table
// [sourceRelation][sourceSex] → inverseRelation

export const RELATIONSHIP_INVERSE_MAP: Record<string, Record<string, string>> = {
  "配偶": { male: "配偶", female: "配偶" },
  "同居人": { male: "同居人", female: "同居人" },
  "父":   { male: "子", female: "女" },
  "母":   { male: "子", female: "女" },
  "子":   { male: "父", female: "母" },
  "女":   { male: "父", female: "母" },
  "兄":   { male: "弟", female: "妹" },
  "弟":   { male: "兄", female: "姊" },
  "姊":   { male: "弟", female: "妹" },
  "妹":   { male: "兄", female: "姊" },
  "祖父": { male: "孫子", female: "孫女" },
  "祖母": { male: "孫子", female: "孫女" },
  "孫子": { male: "祖父", female: "祖母" },
  "孫女": { male: "祖父", female: "祖母" },
  "岳父": { male: "女婿", female: "" },
  "岳母": { male: "女婿", female: "" },
  "公公": { male: "", female: "子媳" },
  "婆婆": { male: "", female: "子媳" },
  "叔":   { male: "姪子", female: "姪女" },
  "伯":   { male: "姪子", female: "姪女" },
  "姑":   { male: "姪子", female: "姪女" },
  "舅":   { male: "外甥", female: "外甥女" },
  "姨":   { male: "外甥", female: "外甥女" },
};

/** All valid relationship type strings (keys of the inverse map) */
export const VALID_RELATIONSHIPS: string[] = Object.keys(RELATIONSHIP_INVERSE_MAP);

/** Look up the inverse relationship given a relation and the source person's sex */
export function getInverseRelationship(
  relation: string,
  sourceSex: "male" | "female"
): string {
  return RELATIONSHIP_INVERSE_MAP[relation]?.[sourceSex] ?? "";
}
