/**
 * Pure utility functions for staff filtering.
 * No side effects, no server dependencies — safe for unit and property-based testing.
 */

export type StaffRecord = {
  id: number;
  name: string;
  aliases: string[];
  email: string | null;
  phone: string | null;
  isActive: boolean;
};

/**
 * Case-insensitive search across name, aliases, email, and phone.
 * Returns the full list when the search term is empty or whitespace-only.
 */
export function filterStaff(
  staffList: StaffRecord[],
  searchTerm: string
): StaffRecord[] {
  const term = searchTerm.trim().toLowerCase();
  if (!term) return staffList;
  return staffList.filter(
    (s) =>
      s.name.toLowerCase().includes(term) ||
      s.aliases.some((a) => a.toLowerCase().includes(term)) ||
      (s.email?.toLowerCase().includes(term) ?? false) ||
      (s.phone?.includes(term) ?? false)
  );
}

/**
 * Return only records where isActive is strictly true.
 */
export function getActiveOnly(staffList: StaffRecord[]): StaffRecord[] {
  return staffList.filter((s) => s.isActive === true);
}
