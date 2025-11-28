import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import mime from "mime";

import { getAbsolutePath } from "@/server/services/asset-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path = [] } = await context.params;
  const segments = path ?? [];
  const storageKey = segments.join("/");

  if (!storageKey) {
    return NextResponse.json({ error: "Missing asset key" }, { status: 400 });
  }

  try {
    const absolutePath = getAbsolutePath(storageKey);
    const file = await fs.readFile(absolutePath);
    const contentType = mime.getType(absolutePath) ?? "application/octet-stream";

    return new NextResponse(file, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load this asset.",
      },
      { status: 404 },
    );
  }
}


