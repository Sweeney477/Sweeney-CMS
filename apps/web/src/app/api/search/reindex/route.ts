import { NextResponse } from "next/server";

import { ApiTokenError, requireApiToken } from "@/server/auth/api-token";
import { reindexSite } from "@/server/services/search-index-service";

export async function POST(request: Request) {
  try {
    const auth = await requireApiToken(request, {
      requiredScopes: ["search:manage"],
    });
    await reindexSite(auth.siteId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ApiTokenError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Failed to trigger search reindex", error);
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}


