import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { getRevisionDiff } from "@/server/services/revision-service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ revisionId: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const compareTo = url.searchParams.get("compareTo") ?? undefined;

  const diff = await getRevisionDiff(params.revisionId, compareTo ?? undefined);
  if (!diff) {
    return NextResponse.json({ error: "Revision not found" }, { status: 404 });
  }

  return NextResponse.json(diff);
}
