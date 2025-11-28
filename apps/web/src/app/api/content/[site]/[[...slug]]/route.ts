import { NextResponse } from "next/server";

import { getRenderablePage } from "@/server/services/page-service";
import { getSiteBySlug } from "@/server/services/site-service";

type Params = {
  params: {
    site: string;
    slug?: string[];
  };
};

export async function GET(request: Request, { params }: Params) {
  const site = await getSiteBySlug(params.site);
  if (!site) {
    return new NextResponse("Site not found", { status: 404 });
  }

  const path = buildPath(params.slug);
  const page = await getRenderablePage({
    siteId: site.id,
    path,
  });

  if (!page) {
    return new NextResponse("Page not found", { status: 404 });
  }

  return NextResponse.json({
    page,
    fetchedAt: new Date().toISOString(),
  });
}

function buildPath(slug?: string[]) {
  if (!slug || slug.length === 0) {
    return "/";
  }
  return `/${slug.join("/")}`;
}


