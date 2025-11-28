import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { regenerateTransforms } from "@/server/services/asset-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json();
  if (!payload?.assetId) {
    return NextResponse.json(
      { error: "assetId is required" },
      { status: 400 },
    );
  }

  const transforms = await regenerateTransforms({ assetId: payload.assetId });
  return NextResponse.json({ transforms });
}

