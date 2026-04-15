import type { ActiveFilter, FilterConfig } from "./filter-config";
import { parseDateRangeValue } from "./filter-url";

/**
 * Build a Prisma where fragment from active filters.
 *
 * Enum fields:      { [field]: value }
 * Boolean fields:   { [field]: value === "true" }
 * Relation fields:  { [field]: { some: { id: parseInt(value) } } }
 * DateRange fields: { [field]: { gte: new Date(from), lte: new Date(to + "T23:59:59.999Z") } }
 */
export function buildFilterWhere(
  filters: ActiveFilter[],
  config: FilterConfig
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  for (const filter of filters) {
    const fieldConfig = config.find((c) => c.field === filter.field);
    if (!fieldConfig) continue;

    switch (fieldConfig.type) {
      case "enum":
        where[filter.field] = filter.value;
        break;
      case "boolean":
        where[filter.field] = filter.value === "true";
        break;
      case "relation":
        where[filter.field] = { some: { id: parseInt(filter.value, 10) } };
        break;
      case "dateRange": {
        const range = parseDateRangeValue(filter.value);
        if (range) {
          where[filter.field] = {
            gte: new Date(range.from),
            lte: new Date(range.to + "T23:59:59.999Z"),
          };
        }
        break;
      }
    }
  }

  return where;
}
