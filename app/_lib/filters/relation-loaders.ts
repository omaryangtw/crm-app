"use server";

import { getActiveStaff } from "@/app/_lib/actions/staff-actions";
import type { ActiveFilter, FilterConfig } from "./filter-config";

/**
 * Server action: load staff options for relation filter fields.
 * Marked "use server" so it can be called from client components.
 */
export async function loadStaffOptions(): Promise<
  { id: string; label: string }[]
> {
  const staff = await getActiveStaff();
  return staff.map((s) => ({ id: String(s.id), label: s.name }));
}

/**
 * Resolve relation filter values to human-readable labels.
 * Call this on the server (in page.tsx) and pass the result to the client.
 * Returns a map of value → display label for all active relation filters.
 */
export async function resolveRelationLabels(
  activeFilters: ActiveFilter[],
  config: FilterConfig,
): Promise<Record<string, string>> {
  const relationFilters = activeFilters.filter((f) => {
    const fc = config.find((c) => c.field === f.field);
    return fc?.type === "relation";
  });

  if (relationFilters.length === 0) return {};

  // Collect all staff IDs needed
  const staffIds = relationFilters
    .filter((f) => f.field === "staffInCharge")
    .map((f) => parseInt(f.value, 10))
    .filter((id) => !isNaN(id));

  if (staffIds.length === 0) return {};

  const staff = await getActiveStaff();
  const labels: Record<string, string> = {};
  for (const s of staff) {
    if (staffIds.includes(s.id)) {
      labels[String(s.id)] = s.name;
    }
  }
  return labels;
}
