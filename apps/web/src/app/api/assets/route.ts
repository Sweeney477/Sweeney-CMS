import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { listAssets, mapAssetToDTO } from "@/server/services/asset-service";

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

  const response = await listAssets({
    siteId,
    folderId: searchParams.get("folderId") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    cursor: searchParams.get("cursor") ?? undefined,
    limit: parseLimit(searchParams.get("limit")),
    tagIds: parseArray(searchParams.getAll("tagIds")),
  });

  return NextResponse.json({
    items: response.items.map(mapAssetToDTO),
    nextCursor: response.nextCursor,
  });
}

function parseLimit(raw: string | null) {
  if (!raw) return undefined;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) {
    return undefined;
  }
  return value;
}

function parseArray(values: string[]) {
  if (!values.length) {
    return undefined;
  }
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}
