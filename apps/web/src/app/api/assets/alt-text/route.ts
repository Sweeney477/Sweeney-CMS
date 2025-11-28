import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/server/auth";
import {
  generateAltTextForAsset,
  updateAssetAltText,
} from "@/server/services/asset-service";

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

  if (payload.mode === "manual") {
    if (!payload.altText) {
      return NextResponse.json(
        { error: "altText is required when mode=manual" },
        { status: 400 },
      );
    }
    await updateAssetAltText(payload.assetId, payload.altText);
    return NextResponse.json({ altText: payload.altText, source: "manual" });
  }

  try {
    const result = await generateAltTextForAsset(
      payload.assetId,
      payload.prompt,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate alt text. Try again later.",
      },
      { status: 400 },
    );
  }
}



