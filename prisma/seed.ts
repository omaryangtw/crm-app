/**
 * Seed script: imports data from the legacy seed/ directory (JSON files)
 * into the new PostgreSQL database via Prisma.
 *
 * Usage: npx tsx prisma/seed.ts
 *
 * This script is idempotent — it truncates all tables before inserting.
 * It maps legacy field names and Chinese enum values to the new Prisma schema.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync } from "fs";
import { join } from "path";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

// Path to the legacy seed directory (one level up from crm-app)
const SEED_DIR = join(__dirname, "..", "..", "seed");

// ── Enum value sets for validation ──
// PostgreSQL stores the @map values from schema.prisma.
// For enums with Chinese @map values, the seed JSON already contains the Chinese strings,
// so we pass them directly. For IncomeStatus/DisabledStatus, the seed JSON uses the
// @map values (e.g. "mid-low", "light") which also go directly to PostgreSQL.

const VALID_GROUPS = new Set([
  "阿美", "泰雅", "布農", "卡那卡那富", "噶瑪蘭", "排灣",
  "卑南", "魯凱", "拉阿魯哇", "賽夏", "撒奇萊雅", "賽德克",
  "太魯閣", "邵", "鄒", "雅美",
]);

const VALID_PLAIN_MOUNTAIN = new Set(["平原", "山原"]);

const VALID_CASE_STATUS = new Set(["處理中", "結案"]);

const VALID_CASE_TYPE_MAJOR = new Set(["一般", "法律", "急難救助"]);

const VALID_CASE_TYPE_MINOR = new Set([
  "一般", "求職", "陳情", "施政建議", "債務", "勞資",
  "車禍", "家事", "繼承", "刑事", "諮詢", "非訟",
  "生活扶助", "死亡救助", "急難紓困", "重大災害", "醫療補助",
]);

const VALID_CONTACT_TYPE = new Set(["撥出", "來電", "親訪", "簡訊"]);

const VALID_INCOME_STATUS = new Set(["low", "mid-low", "mid-low-elderly"]);

const VALID_DISABLED_STATUS = new Set(["light", "mid", "heavy"]);

// ── Helpers ──

/** Return trimmed value if it exists in the valid set, otherwise null */
function validateEnum(value: string | null | undefined, validSet: Set<string>): string | null {
  if (!value || value.trim() === "") return null;
  const trimmed = value.trim();
  return validSet.has(trimmed) ? trimmed : null;
}

function emptyToNull(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") return null;
  return value.trim();
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** Coerce empty strings / non-booleans to a boolean with a default */
function toBool(value: unknown, defaultValue: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "" || value === null || value === undefined) return defaultValue;
  return Boolean(value);
}


// ── Relationship inverse map (same as app/_lib/constants/relationship-map.ts) ──

const RELATIONSHIP_INVERSE_MAP: Record<string, Record<string, string>> = {
  "配偶": { male: "配偶", female: "配偶" },
  "同居人": { male: "同居人", female: "同居人" },
  "父": { male: "子", female: "女" },
  "母": { male: "子", female: "女" },
  "子": { male: "父", female: "母" },
  "女": { male: "父", female: "母" },
  "兄": { male: "弟", female: "妹" },
  "弟": { male: "兄", female: "姊" },
  "姊": { male: "弟", female: "妹" },
  "妹": { male: "兄", female: "姊" },
  "祖父": { male: "孫子", female: "孫女" },
  "祖母": { male: "孫子", female: "孫女" },
  "孫子": { male: "祖父", female: "祖母" },
  "孫女": { male: "祖父", female: "祖母" },
  "岳父": { male: "女婿", female: "" },
  "岳母": { male: "女婿", female: "" },
  "公公": { male: "", female: "子媳" },
  "婆婆": { male: "", female: "子媳" },
  "叔": { male: "姪子", female: "姪女" },
  "伯": { male: "姪子", female: "姪女" },
  "姑": { male: "姪子", female: "姪女" },
  "舅": { male: "外甥", female: "外甥女" },
  "姨": { male: "外甥", female: "外甥女" },
};

// ── Main seed function ──

async function main() {
  console.log("🌱 Starting seed...");
  console.log(`📂 Reading seed data from: ${SEED_DIR}`);

  // Read JSON files
  const rawClients = JSON.parse(readFileSync(join(SEED_DIR, "clients.json"), "utf-8"));
  const rawCases = JSON.parse(readFileSync(join(SEED_DIR, "cases.json"), "utf-8"));
  const rawContacts = JSON.parse(readFileSync(join(SEED_DIR, "contacts.json"), "utf-8"));
  const rawFamilies = JSON.parse(readFileSync(join(SEED_DIR, "families.json"), "utf-8"));

  console.log(`  clients: ${rawClients.length}`);
  console.log(`  cases: ${rawCases.length}`);
  console.log(`  contacts: ${rawContacts.length}`);
  console.log(`  families: ${rawFamilies.length}`);

  // Truncate all tables (order matters due to foreign keys)
  console.log("\n🗑️  Truncating tables...");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "_ContactToStaff", "_CaseToStaff", family_relations, todos, contacts, cases, staff, clients, users RESTART IDENTITY CASCADE`);

  // ── 1. Seed Clients ──
  console.log("\n👤 Seeding clients...");
  let clientCount = 0;
  for (const c of rawClients) {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO clients (id, name, name_alt, idn, sex, birthday, is_dead, household_admin,
          income_status, disabled_status, indigenous_group, tribe, plain_mountain,
          can_call, phone, phone_note, phone_alt, phone_alt_note,
          mobile, mobile_note, mobile_alt, mobile_alt_note,
          can_mail, city, city_alt, dist, dist_alt, vill, vill_alt,
          addr, addr_alt, addr_note, addr_alt_note, note,
          created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36)`,
        c.id,
        emptyToNull(c.name),
        emptyToNull(c.nameAlt),
        emptyToNull(c.IDN),
        emptyToNull(c.sex),                                    // already "male"/"female"
        parseDate(c.birthday),
        toBool(c.isDead, false),
        toBool(c.householdadmin ?? c.householdAdmin, false),    // legacy uses lowercase 'a'
        validateEnum(c.incomeStatus, VALID_INCOME_STATUS),
        validateEnum(c.disabledStatus, VALID_DISABLED_STATUS),
        validateEnum(c.group, VALID_GROUPS),                    // Chinese → PostgreSQL as-is
        emptyToNull(c.tribe),
        validateEnum(c.plainMountain, VALID_PLAIN_MOUNTAIN),    // Chinese → PostgreSQL as-is
        toBool(c.canCall, true),
        emptyToNull(c.phone),
        emptyToNull(c.phoneNote),
        emptyToNull(c.phoneAlt),
        emptyToNull(c.phoneAltNote),
        emptyToNull(c.mobile),
        emptyToNull(c.mobileNote),
        emptyToNull(c.mobileAlt),
        emptyToNull(c.mobileAltNote),
        toBool(c.canMail, true),
        emptyToNull(c.city),
        emptyToNull(c.cityAlt),
        emptyToNull(c.dist),
        emptyToNull(c.distAlt),
        emptyToNull(c.vill),
        emptyToNull(c.villAlt),
        emptyToNull(c.addr),
        emptyToNull(c.addrAlt),
        emptyToNull(c.addrNote),
        emptyToNull(c.addrAltNote),
        emptyToNull(c.note),
        parseDate(c.createdAt) ?? new Date(),
        parseDate(c.updatedAt) ?? new Date(),
      );
      clientCount++;
    } catch (err) {
      console.error(`  ⚠️  Failed to insert client id=${c.id} name=${c.name}:`, (err as Error).message);
    }
  }
  // Reset the auto-increment sequence to max id + 1
  await prisma.$executeRawUnsafe(`SELECT setval('clients_id_seq', (SELECT COALESCE(MAX(id), 0) FROM clients) + 1)`);
  console.log(`  ✅ ${clientCount} clients inserted`);


  // ── 2. Seed Cases ──
  console.log("\n📋 Seeding cases...");
  let caseCount = 0;
  for (const c of rawCases) {
    // Skip cases with no client association
    if (!c.ClientId) continue;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO cases (id, name, status, types_major, types_minor,
          relation1, relation2, relation3, contact1, contact2, contact3,
          note, handle, person_in_charge_legacy, client_id, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        c.id,
        emptyToNull(c.name),
        validateEnum(c.status, VALID_CASE_STATUS),
        validateEnum(c.typesMajor, VALID_CASE_TYPE_MAJOR),
        validateEnum(c.typesMinor, VALID_CASE_TYPE_MINOR),
        emptyToNull(c.relation1),
        emptyToNull(c.relation2),
        emptyToNull(c.relation3),
        emptyToNull(c.contact1),
        emptyToNull(c.contact2),
        emptyToNull(c.contact3),
        emptyToNull(c.note),
        emptyToNull(c.handle),
        emptyToNull(c.personInCharge),
        c.ClientId,
        parseDate(c.createdAt) ?? new Date(),
        parseDate(c.updatedAt) ?? new Date(),
      );
      caseCount++;
    } catch (err) {
      console.error(`  ⚠️  Failed to insert case id=${c.id}:`, (err as Error).message);
    }
  }
  await prisma.$executeRawUnsafe(`SELECT setval('cases_id_seq', (SELECT COALESCE(MAX(id), 0) FROM cases) + 1)`);
  console.log(`  ✅ ${caseCount} cases inserted`);

  // ── 3. Seed Contacts ──
  console.log("\n📞 Seeding contacts...");
  let contactCount = 0;
  for (const c of rawContacts) {
    if (!c.ClientId) continue;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO contacts (id, date, contact_type, is_success, record,
          person_in_charge_legacy, client_id, created_at, updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        c.id,
        parseDate(c.date),
        validateEnum(c.contactType, VALID_CONTACT_TYPE),
        c.isSuccess ?? true,
        emptyToNull(c.record),
        emptyToNull(c.personInCharge),
        c.ClientId,
        parseDate(c.createdAt) ?? new Date(),
        parseDate(c.updatedAt) ?? new Date(),
      );
      contactCount++;
    } catch (err) {
      console.error(`  ⚠️  Failed to insert contact id=${c.id}:`, (err as Error).message);
    }
  }
  await prisma.$executeRawUnsafe(`SELECT setval('contacts_id_seq', (SELECT COALESCE(MAX(id), 0) FROM contacts) + 1)`);
  console.log(`  ✅ ${contactCount} contacts inserted`);

  // ── 4. Seed Family Relations ──
  console.log("\n👨‍👩‍👧‍👦 Seeding family relations...");
  // Build a client sex lookup map
  const clientSexMap = new Map<number, string>();
  for (const c of rawClients) {
    if (c.sex) clientSexMap.set(c.id, c.sex);
  }

  // Track already-inserted pairs to avoid duplicates (since legacy stores one direction per row)
  const insertedPairs = new Set<string>();
  let familyCount = 0;

  for (const f of rawFamilies) {
    const sourceId = f.ClientId;
    const targetId = f.FamilyId;
    const relationship = f.relationship;

    if (!sourceId || !targetId || !relationship) continue;

    // Normalize pair key (always smaller id first)
    const pairKey = sourceId < targetId ? `${sourceId}-${targetId}` : `${targetId}-${sourceId}`;
    if (insertedPairs.has(pairKey)) continue;

    const sourceSex = clientSexMap.get(sourceId);
    const inverse = sourceSex
      ? (RELATIONSHIP_INVERSE_MAP[relationship]?.[sourceSex] ?? relationship)
      : relationship;

    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO family_relations (person_a_id, person_b_id, relation_a_to_b, relation_b_to_a)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (person_a_id, person_b_id) DO NOTHING`,
        sourceId,
        targetId,
        relationship,
        inverse,
      );
      insertedPairs.add(pairKey);
      familyCount++;
    } catch (err) {
      console.error(`  ⚠️  Failed to insert family ${sourceId}→${targetId}:`, (err as Error).message);
    }
  }
  await prisma.$executeRawUnsafe(`SELECT setval('family_relations_id_seq', (SELECT COALESCE(MAX(id), 0) FROM family_relations) + 1)`);
  console.log(`  ✅ ${familyCount} family relations inserted`);

  // ── 5. Create default admin user ──
  console.log("\n🔑 Creating default admin user...");
  const bcrypt = await import("bcrypt");
  const hashedPassword = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@crm.local" },
    update: {},
    create: {
      email: "admin@crm.local",
      password: hashedPassword,
      role: "admin",
    },
  });
  console.log("  ✅ Admin user: admin@crm.local / admin123");

  console.log("\n🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
