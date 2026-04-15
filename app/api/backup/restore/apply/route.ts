import { NextResponse } from "next/server";
import { auth } from "@/app/_lib/auth";
import { applyRestore, ConflictResolution } from "@/app/_lib/utils/restore";
import { BACKUP_DIR } from "@/app/_lib/utils/backup";
import { join } from "path";
import { access } from "fs/promises";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "權限不足" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { snapshotName, conflictResolutions } = body as {
      snapshotName: string;
      conflictResolutions: ConflictResolution[];
    };

    // Validate snapshot directory exists
    const snapshotDir = join(BACKUP_DIR, snapshotName);
    try {
      await access(snapshotDir);
    } catch {
      return NextResponse.json(
        { error: "找不到指定的備份" },
        { status: 404 }
      );
    }

    const result = await applyRestore(snapshotName, conflictResolutions ?? []);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "還原失敗，已回滾所有變更";

    if (message === "還原作業進行中") {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    if (message === "尚有未解決的衝突記錄") {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (message === "備份不完整，無法還原") {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("[Restore Apply] Failed:", error);
    return NextResponse.json(
      { error: "還原失敗，已回滾所有變更" },
      { status: 500 }
    );
  }
}
