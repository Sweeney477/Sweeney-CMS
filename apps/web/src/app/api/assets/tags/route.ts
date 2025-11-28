import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { createTag, listAssetTags } from "@/server/services/asset-service";

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

  const tags = await listAssetTags(siteId);
  return NextResponse.json({ tags });
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

  const tag = await createTag({
    siteId: payload.siteId,
    name: payload.name,
    color: payload.color,
    description: payload.description,
  });

  return NextResponse.json({ tag }, { status: 201 });
}



