import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { env } from "@/env";

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.secret || body.secret !== env.REVALIDATION_SECRET) {
    return new NextResponse("Invalid secret", { status: 401 });
  }

  if (!body.path || typeof body.path !== "string") {
    return new NextResponse("Missing path", { status: 400 });
  }

  revalidatePath(body.path);

  return NextResponse.json({ revalidated: true, path: body.path });
}




