import { NextResponse } from "next/server";
import { prisma } from "@/app/_lib/db";
import { auth } from "@/app/_lib/auth";

/**
 * Returns address/tribe/group fields from an existing client
 * for pre-filling a "new family member" form.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({}, { status: 401 });

  const { id } = await params;
  const client = await prisma.client.findUnique({
    where: { id: parseInt(id, 10) },
    select: {
      city: true,
      cityAlt: true,
      dist: true,
      distAlt: true,
      vill: true,
      villAlt: true,
      addr: true,
      addrAlt: true,
      tribe: true,
      indigenousGroup: true,
      plainMountain: true,
    },
  });

  if (!client) return NextResponse.json({}, { status: 404 });

  // Only return non-null fields
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(client)) {
    if (value != null) result[key] = value;
  }

  return NextResponse.json(result);
}
