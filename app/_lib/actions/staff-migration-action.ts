"use server";

import { prisma } from "../db";
import { auth } from "../auth";

// ── Typo / shortname corrections ──
const CORRECTIONS: Record<string, string> = {
  "AliasA": "AliasA", "AliasB": "AliasB", "AliasB": "AliasB",
  "Ingay": "Ingay", "AliasC": "AliasC", "StaffA": "StaffA",
  "StaffB": "StaffB", "StaffF": "StaffF", "StaffC": "StaffC",
  "StaffE": "StaffE", "StaffG": "StaffG", "StaffD": "StaffD",
  "Ingay": "Ingay", "IngayIngay": "Ingay",
};

// ── Canonical staff registry ──
const STAFF_REGISTRY: { name: string; aliases: string[] }[] = [
  { name: "StaffA", aliases: ["AliasA"] },
  { name: "Fali", aliases: [] },
  { name: "StaffL", aliases: [] },
  { name: "Ingay", aliases: [] },
  { name: "AliasB", aliases: [] },
  { name: "StaffB", aliases: [] },
  { name: "StaffC", aliases: ["AliasD"] },
  { name: "StaffD", aliases: ["AliasC"] },
  { name: "StaffE", aliases: ["Fox"] },
  { name: "StaffK", aliases: [] },
  { name: "StaffF", aliases: [] },
  { name: "StaffG", aliases: [] },
  { name: "特助", aliases: [] },
  { name: "StaffH", aliases: [] },
  { name: "StaffI", aliases: [] },
  { name: "StaffTeam", aliases: [] },
  { name: "StaffM", aliases: [] },
  { name: "StaffJ", aliases: [] },
];

function buildLookupMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of STAFF_REGISTRY) {
    map.set(entry.name.toLowerCase(), entry.name);
    for (const alias of entry.aliases) map.set(alias.toLowerCase(), entry.name);
  }
  return map;
}

function parseNames(raw: string): string[] {
  const t = raw.trim();
  if (t === "#N/A" || t === "N/A" || t === "-") return [];
  let n = t.replace(/[()（）]/g, "/");
  n = n.replace(/([\u4e00-\u9fff])\s+([A-Za-z])/g, "$1/$2");
  n = n.replace(/([A-Za-z])\s+([\u4e00-\u9fff])/g, "$1/$2");
  n = n.replace(/([A-Za-z])\s+([A-Z])/g, "$1/$2");
  return n.split(/[/／、,.]|\s{2,}/).map(s => s.trim()).filter(s => s && s !== "#N" && s !== "A");
}

export interface StaffMigrationResult {
  success: boolean;
  staffCreated: number;
  caseLinks: number;
  contactLinks: number;
  unresolved: string[];
  error?: string;
}

export async function runStaffMigration(): Promise<StaffMigrationResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, staffCreated: 0, caseLinks: 0, contactLinks: 0, unresolved: [], error: "權限不足" };
  }

  const lookupMap = buildLookupMap();

  // Step 1: Clear existing staff and join tables
  await prisma.$executeRawUnsafe(`DELETE FROM "_CaseToStaff"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "_ContactToStaff"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "_StaffToTodo"`);
  await prisma.$executeRawUnsafe(`DELETE FROM staff`);

  // Step 2: Create canonical staff records
  const nameToId = new Map<string, number>();
  for (const entry of STAFF_REGISTRY) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO staff (name, aliases, is_active, created_at, updated_at) VALUES ($1, $2, true, NOW(), NOW())`,
      entry.name, entry.aliases,
    );
    const rows = await prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM staff WHERE name = $1 LIMIT 1`, entry.name,
    );
    nameToId.set(entry.name, rows[0].id);
  }

  // Step 3: Query legacy values
  const caseRows = await prisma.$queryRawUnsafe<{ id: number; person_in_charge_legacy: string }[]>(
    `SELECT id, person_in_charge_legacy FROM cases WHERE person_in_charge_legacy IS NOT NULL AND TRIM(person_in_charge_legacy) != ''`,
  );
  const contactRows = await prisma.$queryRawUnsafe<{ id: number; person_in_charge_legacy: string }[]>(
    `SELECT id, person_in_charge_legacy FROM contacts WHERE person_in_charge_legacy IS NOT NULL AND TRIM(person_in_charge_legacy) != ''`,
  );

  function resolveStaffId(rawName: string): number | null {
    const corrected = CORRECTIONS[rawName] ?? rawName;
    const canonical = lookupMap.get(corrected.toLowerCase());
    return canonical ? (nameToId.get(canonical) ?? null) : null;
  }

  // Step 4: Link cases
  let caseLinks = 0;
  const unresolvedNames = new Set<string>();
  for (const row of caseRows) {
    for (const name of parseNames(row.person_in_charge_legacy)) {
      const staffId = resolveStaffId(name);
      if (!staffId) { unresolvedNames.add(name); continue; }
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "_CaseToStaff" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          row.id, staffId,
        );
        caseLinks++;
      } catch { /* skip */ }
    }
  }

  // Step 5: Link contacts
  let contactLinks = 0;
  for (const row of contactRows) {
    for (const name of parseNames(row.person_in_charge_legacy)) {
      const staffId = resolveStaffId(name);
      if (!staffId) { unresolvedNames.add(name); continue; }
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "_ContactToStaff" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          row.id, staffId,
        );
        contactLinks++;
      } catch { /* skip */ }
    }
  }

  return {
    success: true,
    staffCreated: STAFF_REGISTRY.length,
    caseLinks,
    contactLinks,
    unresolved: [...unresolvedNames],
  };
}
