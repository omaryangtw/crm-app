import { readFileSync } from "fs";
import { join } from "path";

export interface StaffRegistryConfig {
  corrections: Record<string, string>;
  registry: { name: string; aliases: string[] }[];
}

/**
 * Load the staff registry config. The JSON file is gitignored because it
 * contains real staff names (PII); copy staff-registry.example.json to
 * staff-registry.json and fill in the real data.
 */
export function loadStaffRegistry(): StaffRegistryConfig {
  const configPath = join(process.cwd(), "prisma", "staff-registry.json");
  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as StaffRegistryConfig;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `Missing ${configPath}. Copy prisma/staff-registry.example.json to prisma/staff-registry.json and fill in the real staff data.`
      );
    }
    throw err;
  }
}
