import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/server/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const path = searchParams.get("path") ?? "/";
  const siteSlug = searchParams.get("site");

  if (!token || !siteSlug) {
    return new NextResponse("Missing token or site", { status: 400 });
  }

  const site = await prisma.site.findUnique({
    where: { slug: siteSlug },
  });

  if (!site || site.previewSecret !== token) {
    return new NextResponse("Invalid preview token", { status: 401 });
  }

  draftMode().enable();

  const redirectUrl = new URL(path, request.url);
  redirectUrl.searchParams.set("site", site.slug);

  return NextResponse.redirect(redirectUrl, {
    status: 307,
  });
}


