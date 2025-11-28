import { NextRequest, NextResponse } from "next/server";

import { ApiTokenError, requireApiToken } from "@/server/auth/api-token";
import { getRenderablePage } from "@/server/services/page-service";
import { getSiteBySlug } from "@/server/services/site-service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ site: string; slug?: string[] }> },
) {
  try {
    const params = await context.params;
    const site = await getSiteBySlug(params.site);
    if (!site) {
      return errorResponse(404, "Site not found.");
    }

    const token = await requireApiToken(request, {
      requiredScopes: ["content:read"],
      siteId: site.id,
    });

    const url = new URL(request.url);
    const includeDraft =
      readBoolean(url.searchParams.get("draft")) &&
      token.scopes.includes("content:drafts");
    const path = buildPath(params.slug);

    const page = await getRenderablePage({
      siteId: site.id,
      path,
      includeDraft,
    });

    if (!page) {
      return errorResponse(404, "Page not found.");
    }

    return NextResponse.json({
      page,
      site: {
        id: site.id,
        slug: site.slug,
        name: site.name,
      },
      draft: includeDraft,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof ApiTokenError) {
      return errorResponse(error.status, error.message);
    }

    console.error("Headless content API error", error);
    return errorResponse(500, "Unexpected error.");
  }
}

function buildPath(slug?: string[]) {
  if (!slug || slug.length === 0) {
    return "/";
  }
  return `/${slug.join("/")}`;
}

function readBoolean(value: string | null) {
  if (!value) {
    return false;
  }
  return ["1", "true", "yes"].includes(value.toLowerCase());
}

function errorResponse(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

