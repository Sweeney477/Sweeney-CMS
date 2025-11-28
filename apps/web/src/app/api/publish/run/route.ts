import { NextResponse } from "next/server";

import { env } from "@/env";
import { publishDueRevisions } from "@/server/services/scheduler-service";

export async function POST(request: Request) {
  const secret = env.PUBLISH_CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Cron secret is not configured." },
      { status: 501 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { published } = await publishDueRevisions();
  return NextResponse.json({ published });
}

export async function GET(request: Request) {
  return POST(request);
}

