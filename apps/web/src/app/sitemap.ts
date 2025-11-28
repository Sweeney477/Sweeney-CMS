import type { MetadataRoute } from "next";

import { env } from "@/env";
import { prisma } from "@/server/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sites = await prisma.site.findMany({
    select: {
      id: true,
      slug: true,
      domain: true,
      updatedAt: true,
      createdAt: true,
    },
  });

  const fallbackBase = new URL(env.NEXT_PUBLIC_APP_URL);
  const entries: MetadataRoute.Sitemap = [];

  for (const site of sites) {
    const pages = await prisma.page.findMany({
      where: { siteId: site.id, status: "PUBLISHED" },
      select: { path: true, updatedAt: true },
    });

    for (const page of pages) {
      entries.push({
        url: buildPageUrl({
          path: page.path,
          siteDomain: site.domain,
          siteSlug: site.slug,
          fallbackBase,
        }),
        lastModified: page.updatedAt ?? site.updatedAt ?? site.createdAt,
        changeFrequency: "weekly",
        priority: page.path === "/" ? 1 : 0.6,
      });
    }
  }

  return entries;
}

function buildPageUrl({
  path,
  siteDomain,
  siteSlug,
  fallbackBase,
}: {
  path: string;
  siteDomain: string | null;
  siteSlug: string;
  fallbackBase: URL;
}) {
  const normalizedPath = path?.startsWith("/") ? path : `/${path ?? ""}`;
  if (siteDomain) {
    const base = new URL(`https://${siteDomain}`);
    return new URL(normalizedPath, base).toString();
  }

  const url = new URL(fallbackBase.toString());
  url.pathname = normalizedPath;
  url.searchParams.set("site", siteSlug);
  return url.toString();
}


