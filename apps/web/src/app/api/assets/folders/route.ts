import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { createFolder, listAssetFolders } from "@/server/services/asset-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("siteId");
  if (!siteId) {
    return NextResponse.json({ error: "siteId is required" }, { status: 400 });
  }

  const folders = await listAssetFolders(siteId);
  return NextResponse.json({ folders });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  if (!payload?.siteId || !payload?.name) {
    return NextResponse.json(
      { error: "siteId and name are required" },
      { status: 400 },
    );
  }

  const folder = await createFolder({
    siteId: payload.siteId,
    name: payload.name,
    parentId: payload.parentId,
  });

  return NextResponse.json({ folder }, { status: 201 });
}



