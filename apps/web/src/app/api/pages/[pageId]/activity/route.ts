import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { listPageActivity } from "@/server/services/activity-service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> },
) {
  const params = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = url.searchParams.get("limit");
  const activity = await listPageActivity(params.pageId, {
    limit: limit ? Number.parseInt(limit, 10) : undefined,
  });

  return NextResponse.json({
    items: activity.map((item) => ({
      ...item,
      occurredAt: item.occurredAt.toISOString(),
    })),
  });
}


