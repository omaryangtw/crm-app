import { NextResponse } from "next/server";
import { auth } from "@/app/_lib/auth";
import { runBackup, listBackups, cleanupOldBackups } from "@/app/_lib/utils/backup";

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "權限不足" }, { status: 403 });
  }

  try {
    const backups = await listBackups();
    return NextResponse.json(backups);
  } catch (error) {
    console.error("[Backup] Failed to list backups:", error);
    return NextResponse.json(
      { error: "無法取得備份清單" },
      { status: 500 }
    );
  }
}

export async function POST() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "權限不足" }, { status: 403 });
  }

  try {
    const backupResult = await runBackup();

    // Run cleanup after backup completes
    await cleanupOldBackups();

    // Partial failure → HTTP 207
    if (backupResult.metadata.status === "partial") {
      return NextResponse.json(
        { success: true, ...backupResult },
        { status: 207 }
      );
    }

    return NextResponse.json({ success: true, ...backupResult });
  } catch (error) {
    console.error("[Backup] Manual backup failed:", error);
    return NextResponse.json(
      { success: false, error: "備份失敗" },
      { status: 500 }
    );
  }
}
