import { prisma } from "../db";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { format } from "date-fns";

const BACKUP_DIR = process.env.BACKUP_DIR || "./backups";

export async function runBackup(): Promise<void> {
  const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
  const dir = join(BACKUP_DIR, timestamp);
  await mkdir(dir, { recursive: true });

  const tables = [
    { name: "clients", query: () => prisma.client.findMany() },
    { name: "cases", query: () => prisma.case.findMany() },
    { name: "contacts", query: () => prisma.contact.findMany() },
    {
      name: "family_relations",
      query: () => prisma.familyRelation.findMany(),
    },
  ];

  for (const table of tables) {
    try {
      const data = await table.query();
      await writeFile(
        join(dir, `${table.name}.json`),
        JSON.stringify(data, null, 2)
      );
    } catch (error) {
      console.error(`Backup failed for ${table.name}:`, error);
      throw error;
    }
  }
}
