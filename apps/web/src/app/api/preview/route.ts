import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

import { encodePreviewCookie, PREVIEW_REVISION_COOKIE } from "@/lib/preview";
import { prisma } from "@/server/db";
import { resolvePreviewToken } from "@/server/services/preview-service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const path = searchParams.get("path") ?? "/";
  const siteSlug = searchParams.get("site");

  if (!token || !siteSlug) {
    return new NextResponse("Missing token or site", { status: 400 });
  }

  const revisionToken = await resolvePreviewToken(token);

  if (revisionToken) {
    const siteForToken = revisionToken.page?.site;
    if (!siteForToken || siteForToken.slug !== siteSlug) {
      return new NextResponse("Invalid preview token", { status: 401 });
    }

    const draft = await draftMode();
    draft.enable();

    const redirectUrl = new URL(revisionToken.page.path ?? "/", request.url);
    redirectUrl.searchParams.set("site", siteSlug);

    const response = NextResponse.redirect(redirectUrl, {
      status: 307,
    });

    const secondsRemaining = Math.max(
      1,
      Math.floor(
        (revisionToken.expiresAt.getTime() - Date.now()) / 1000,
      ),
    );

    response.cookies.set(
      PREVIEW_REVISION_COOKIE,
      encodePreviewCookie(revisionToken.revisionId, revisionToken.page.siteId),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: secondsRemaining,
      },
    );

    return response;
  }

  const site = await prisma.site.findUnique({
    where: { slug: siteSlug },
  });

  if (!site || site.previewSecret !== token) {
    return new NextResponse("Invalid preview token", { status: 401 });
  }

  const draft = await draftMode();
  draft.enable();

  const redirectUrl = new URL(path, request.url);
  redirectUrl.searchParams.set("site", site.slug);

  const response = NextResponse.redirect(redirectUrl, {
    status: 307,
  });

  response.cookies.delete(PREVIEW_REVISION_COOKIE);

  return response;
}
