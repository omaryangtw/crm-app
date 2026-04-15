export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = await import("node-cron");
    const { runBackup, cleanupOldBackups } = await import(
      "@/app/_lib/utils/backup"
    );

    cron.default.schedule("0 2 * * *", async () => {
      console.log("[Backup] Starting nightly backup...");
      try {
        const result = await runBackup();

        if (result.metadata.status === "partial" && result.metadata.errors) {
          const failedTables = result.metadata.errors
            .map((e) => `${e.table}: ${e.error}`)
            .join("; ");
          console.error(
            `[Backup] Partial backup (${result.snapshotName}). Failed tables: ${failedTables}`
          );
        } else {
          console.log(
            `[Backup] Completed successfully (${result.snapshotName}).`
          );
        }

        const deleted = await cleanupOldBackups();
        if (deleted.length > 0) {
          console.log(
            `[Backup] Cleanup removed ${deleted.length} old backup(s): ${deleted.join(", ")}`
          );
        }
      } catch (err) {
        console.error("[Backup] Failed:", err);
      }
    });
  }
}
