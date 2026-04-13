export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const cron = await import("node-cron");
    const { runBackup } = await import("@/app/_lib/utils/backup");

    cron.default.schedule("0 2 * * *", async () => {
      console.log("[Backup] Starting nightly backup...");
      try {
        await runBackup();
        console.log("[Backup] Completed successfully.");
      } catch (err) {
        console.error("[Backup] Failed:", err);
      }
    });
  }
}
