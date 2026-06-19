import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { auth } from "@/app/_lib/auth";

// Serve uploaded client photos by reading from disk at request time.
// This avoids Next.js standalone's behaviour of caching the public/ directory
// at server startup, which causes newly uploaded files to 404 until restart.

const PHOTOS_DIR = path.join(process.cwd(), "public", "uploads", "photos");

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { name } = await params;

  // Path traversal guard: allow only simple filenames with known extensions
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes("..")) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  const ext = path.extname(name).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return new NextResponse("Unsupported media type", { status: 415 });
  }

  try {
    const file = await readFile(path.join(PHOTOS_DIR, name));
    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
}
