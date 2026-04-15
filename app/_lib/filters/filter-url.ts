import type { ActiveFilter, FilterConfig, FilterFieldConfig } from "./filter-config";

const FILTER_PREFIX = "f_";

/**
 * Parse URL searchParams into validated ActiveFilter[].
 * Ignores unrecognized fields and invalid values.
 */
export function parseFilters(
  params: Record<string, string | undefined>,
  config: FilterConfig
): ActiveFilter[] {
  const result: ActiveFilter[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (!key.startsWith(FILTER_PREFIX) || value === undefined) continue;

    const field = key.slice(FILTER_PREFIX.length);
    const fieldConfig = config.find((c) => c.field === field);
    if (!fieldConfig) continue;

    if (!isValidValue(fieldConfig, value)) continue;

    result.push({ field, value });
  }

  return result;
}

/**
 * Serialize ActiveFilter[] into URL query param entries.
 * Each filter becomes f_{field}={value}.
 */
export function serializeFilters(
  filters: ActiveFilter[]
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const f of filters) {
    result[`${FILTER_PREFIX}${f.field}`] = f.value;
  }
  return result;
}

/**
 * Resolve the display labels for a filter value given its field config.
 * For relation fields, pass `relationLabels` (a map of value→display name)
 * to show human-readable labels instead of raw IDs.
 * Returns null if field not found or value not valid.
 */
export function resolveFilterLabel(
  filter: ActiveFilter,
  config: FilterConfig,
  relationLabels?: Record<string, string>,
): { fieldLabel: string; valueLabel: string } | null {
  const fieldConfig = config.find((c) => c.field === filter.field);
  if (!fieldConfig) return null;

  switch (fieldConfig.type) {
    case "enum": {
      const valueLabel = fieldConfig.options[filter.value];
      if (!valueLabel) return null;
      return { fieldLabel: fieldConfig.label, valueLabel };
    }
    case "boolean": {
      if (filter.value !== "true" && filter.value !== "false") return null;
      return {
        fieldLabel: fieldConfig.label,
        valueLabel:
          filter.value === "true" ? fieldConfig.trueLabel : fieldConfig.falseLabel,
      };
    }
    case "relation": {
      if (!filter.value) return null;
      const valueLabel = relationLabels?.[filter.value] ?? filter.value;
      return { fieldLabel: fieldConfig.label, valueLabel };
    }
    case "dateRange": {
      const parsed = parseDateRangeValue(filter.value);
      if (!parsed) return null;
      return {
        fieldLabel: fieldConfig.label,
        valueLabel: `${parsed.from} ~ ${parsed.to}`,
      };
    }
  }
}

/** Check if a value is valid for the given field config type */
function isValidValue(fieldConfig: FilterFieldConfig, value: string): boolean {
  switch (fieldConfig.type) {
    case "enum":
      return value in fieldConfig.options;
    case "boolean":
      return value === "true" || value === "false";
    case "relation":
      return value.length > 0;
    case "dateRange":
      return parseDateRangeValue(value) !== null;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a "YYYY-MM-DD..YYYY-MM-DD" value into { from, to } or null */
export function parseDateRangeValue(
  value: string,
): { from: string; to: string } | null {
  const parts = value.split("..");
  if (parts.length !== 2) return null;
  const [from, to] = parts;
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return null;
  if (from > to) return null;
  return { from, to };
}
