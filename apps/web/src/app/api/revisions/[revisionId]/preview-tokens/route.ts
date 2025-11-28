import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/server/auth";
import {
  createRevisionPreviewToken,
  listRevisionPreviewTokens,
} from "@/server/services/preview-service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ revisionId: string }> },
) {
  const params = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tokens = await listRevisionPreviewTokens(params.revisionId);
    return NextResponse.json({ tokens });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to load preview links." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ revisionId: string }> },
) {
  const params = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let expiresInHours: number | undefined;
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      expiresInHours?: number;
    };
    if (
      typeof payload.expiresInHours === "number" &&
      Number.isFinite(payload.expiresInHours)
    ) {
      const clamped = Math.min(Math.max(payload.expiresInHours, 1), 24 * 14);
      expiresInHours = clamped;
    }
  } catch {
    // ignore invalid payloads and fall back to defaults
  }

  try {
    const token = await createRevisionPreviewToken({
      revisionId: params.revisionId,
      createdById: session.user.id,
      expiresAt: expiresInHours
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
        : undefined,
    });
    return NextResponse.json({ token }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create preview link." },
      { status: 400 },
    );
  }
}


