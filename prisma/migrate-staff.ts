/**
 * Data migration script: backfill staff records from legacy free-text
 * `person_in_charge_legacy` columns in cases and contacts tables.
 *
 * This version uses a canonical STAFF_REGISTRY with aliases and a
 * CORRECTIONS map to handle typos, shortnames, and deduplication.
 *
 * Steps:
 * 1. Clear existing staff and join tables
 * 2. Create the 14 canonical staff records with their aliases
 * 3. For each case/contact with person_in_charge_legacy:
 *    - Parse multi-value strings into individual names
 *    - Apply corrections
 *    - Look up canonical staff via lookup map
 *    - Insert into join tables
 * 4. Log results
 *
 * Usage: npx tsx prisma/migrate-staff.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

// ── Typo / shortname corrections ──
const CORRECTIONS: Record<string, string> = {
  "AliasA": "AliasA",
  "AliasB": "AliasB",
  "AliasB": "AliasB",
  "Ingay": "Ingay",
  "AliasC": "AliasC",
  "StaffA": "StaffA",
  "StaffB": "StaffB",
  "StaffF": "StaffF",
  "StaffC": "StaffC",
  "StaffE": "StaffE",
  "StaffG": "StaffG",
  "StaffD": "StaffD",
  "Ingay": "Ingay",
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
];

// ── Build lookup map: name/alias → canonical name (case-insensitive) ──
function buildLookupMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of STAFF_REGISTRY) {
    map.set(entry.name.toLowerCase(), entry.name);
    for (const alias of entry.aliases) {
      map.set(alias.toLowerCase(), entry.name);
    }
  }
  return map;
}

/**
 * Split a multi-value person_in_charge string into individual names.
 * Handles: / ／ 、 , . 2+ spaces, parentheses like "Ingay (nakaw)",
 * and mixed CJK/Latin like "StaffE AliasA" or "AliasA StaffE".
 */
export function parseNames(raw: string): string[] {
  const trimmedRaw = raw.trim();
  if (trimmedRaw === "#N/A" || trimmedRaw === "N/A" || trimmedRaw === "-") return [];

  // Replace parentheses with delimiter
  let normalized = trimmedRaw.replace(/[()（）]/g, "/");

  // Insert delimiter between CJK and Latin (single space boundary)
  // "StaffE AliasA" → "StaffE/AliasA", "AliasA StaffE" → "AliasA/StaffE"
  normalized = normalized.replace(
    /([\u4e00-\u9fff])\s+([A-Za-z])/g,
    "$1/$2"
  );
  normalized = normalized.replace(
    /([A-Za-z])\s+([\u4e00-\u9fff])/g,
    "$1/$2"
  );

  // Split on: / ／ 、 , . or 2+ consecutive spaces
  const parts = normalized.split(/[/／、,.]|\s{2,}/);
  return parts
    .map((s) => s.trim())
    .filter((s) => s !== "" && s !== "#N" && s !== "A" && s !== "#N/A" && s !== "N/A" && s !== "-");
}

async function main() {
  console.log("🚀 Starting staff migration (dedup with corrections)...\n");

  const lookupMap = buildLookupMap();

  // Step 1: Clear existing staff and join tables
  console.log("🗑️  Step 1: Clearing existing staff and join tables...");
  await prisma.$executeRawUnsafe(`DELETE FROM "_CaseToStaff"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "_ContactToStaff"`);
  await prisma.$executeRawUnsafe(`DELETE FROM staff`);
  console.log("  ✅ Cleared");

  // Step 2: Create the 14 canonical staff records
  console.log("\n👤 Step 2: Creating canonical staff records...");
  const nameToId = new Map<string, number>();

  for (const entry of STAFF_REGISTRY) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO staff (name, aliases, is_active, created_at, updated_at) VALUES ($1, $2, true, NOW(), NOW())`,
      entry.name,
      entry.aliases
    );
    const inserted = await prisma.$queryRawUnsafe<{ id: number }[]>(
      `SELECT id FROM staff WHERE name = $1 LIMIT 1`,
      entry.name
    );
    nameToId.set(entry.name, inserted[0].id);
    console.log(`  ✅ Created "${entry.name}" (id=${inserted[0].id})${entry.aliases.length > 0 ? ` aliases: [${entry.aliases.join(", ")}]` : ""}`);
  }

  console.log(`  Total: ${STAFF_REGISTRY.length} staff records`);

  // Step 3: Extract legacy values and link
  console.log("\n📋 Step 3: Extracting person_in_charge_legacy values...");

  const caseRows = await prisma.$queryRawUnsafe<{ id: number; person_in_charge_legacy: string }[]>(
    `SELECT id, person_in_charge_legacy FROM cases WHERE person_in_charge_legacy IS NOT NULL AND TRIM(person_in_charge_legacy) != ''`
  );
  const contactRows = await prisma.$queryRawUnsafe<{ id: number; person_in_charge_legacy: string }[]>(
    `SELECT id, person_in_charge_legacy FROM contacts WHERE person_in_charge_legacy IS NOT NULL AND TRIM(person_in_charge_legacy) != ''`
  );

  console.log(`  Found ${caseRows.length} cases, ${contactRows.length} contacts with legacy values`);

  // Helper: resolve a raw name to canonical staff ID
  function resolveStaffId(rawName: string): number | null {
    // Apply correction first
    const corrected = CORRECTIONS[rawName] ?? rawName;
    // Case-insensitive lookup
    const canonical = lookupMap.get(corrected.toLowerCase());
    if (canonical) return nameToId.get(canonical) ?? null;
    return null;
  }

  // Step 4: Link cases to staff
  console.log("\n📋 Step 4: Linking cases to staff...");
  let caseLinks = 0;
  let caseUnresolved = 0;
  const unresolvedNames = new Set<string>();

  for (const row of caseRows) {
    const names = parseNames(row.person_in_charge_legacy);
    for (const name of names) {
      const staffId = resolveStaffId(name);
      if (!staffId) {
        unresolvedNames.add(name);
        caseUnresolved++;
        continue;
      }
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "_CaseToStaff" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          row.id,
          staffId
        );
        caseLinks++;
      } catch (err) {
        console.error(`  ⚠️  Failed to link case ${row.id} → "${name}":`, (err as Error).message);
      }
    }
  }
  console.log(`  ✅ Created ${caseLinks} case-staff links (${caseUnresolved} unresolved)`);

  // Step 5: Link contacts to staff
  console.log("\n📞 Step 5: Linking contacts to staff...");
  let contactLinks = 0;
  let contactUnresolved = 0;

  for (const row of contactRows) {
    const names = parseNames(row.person_in_charge_legacy);
    for (const name of names) {
      const staffId = resolveStaffId(name);
      if (!staffId) {
        unresolvedNames.add(name);
        contactUnresolved++;
        continue;
      }
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "_ContactToStaff" ("A", "B") VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          row.id,
          staffId
        );
        contactLinks++;
      } catch (err) {
        console.error(`  ⚠️  Failed to link contact ${row.id} → "${name}":`, (err as Error).message);
      }
    }
  }
  console.log(`  ✅ Created ${contactLinks} contact-staff links (${contactUnresolved} unresolved)`);

  // Step 6: Summary
  console.log("\n📊 Migration Summary:");
  console.log(`  Staff records created: ${STAFF_REGISTRY.length}`);
  console.log(`  Case-staff links: ${caseLinks}`);
  console.log(`  Contact-staff links: ${contactLinks}`);

  if (unresolvedNames.size > 0) {
    console.log(`\n  ⚠️  Unresolved names (${unresolvedNames.size}): ${Array.from(unresolvedNames).join(", ")}`);
  }

  // Verify staff count
  const staffCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*) as count FROM staff`
  );
  console.log(`\n  Final staff count: ${staffCount[0].count}`);

  console.log("\n🎉 Staff migration complete!");
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
