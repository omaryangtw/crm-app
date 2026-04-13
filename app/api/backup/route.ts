import { NextResponse } from "next/server";
import { auth } from "@/app/_lib/auth";
import { prisma } from "@/app/_lib/db";
import { runBackup } from "@/app/_lib/utils/backup";

export async function GET() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "權限不足" }, { status: 403 });
  }

  const familyRelations = await prisma.familyRelation.findMany({
    include: {
      personA: { select: { id: true, name: true } },
      personB: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(familyRelations);
}

export async function POST() {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ error: "權限不足" }, { status: 403 });
  }

  try {
    await runBackup();
    return NextResponse.json({ success: true, message: "備份完成" });
  } catch (error) {
    console.error("[Backup] Manual backup failed:", error);
    return NextResponse.json(
      { success: false, error: "備份失敗" },
      { status: 500 }
    );
  }
}
