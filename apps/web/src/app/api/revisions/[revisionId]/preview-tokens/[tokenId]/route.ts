import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/server/auth";
import { revokeRevisionPreviewToken } from "@/server/services/preview-service";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ revisionId: string; tokenId: string }> },
) {
  const params = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const token = await revokeRevisionPreviewToken({
      revisionId: params.revisionId,
      tokenId: params.tokenId,
    });

    if (!token) {
      return NextResponse.json({ error: "Preview link not found." }, { status: 404 });
    }

    return NextResponse.json({ token });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to revoke preview link." },
      { status: 500 },
    );
  }
}


