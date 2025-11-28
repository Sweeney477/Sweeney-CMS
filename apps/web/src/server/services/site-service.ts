import "server-only";

import type { Site } from "@prisma/client";

import { prisma } from "@/server/db";

export type SiteSummary = Pick<
  Site,
  "id" | "name" | "slug" | "domain" | "updatedAt" | "previewSecret"
> & {
  pageCount: number;
};

const DEFAULT_SITE_SLUG = "primary";

export async function listSites(): Promise<SiteSummary[]> {
  const sites = await prisma.site.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          pages: true,
        },
      },
    },
  });

  return sites.map((site) => ({
    id: site.id,
    name: site.name,
    slug: site.slug,
    domain: site.domain,
    updatedAt: site.updatedAt,
    previewSecret: site.previewSecret,
    pageCount: site._count.pages,
  }));
}

export async function getSiteBySlug(slug: string) {
  return prisma.site.findUnique({ where: { slug } });
}

export async function getSiteById(id: string) {
  return prisma.site.findUnique({ where: { id } });
}

export async function resolveActiveSite(
  options: { siteSlug?: string | null; domain?: string | null } = {},
) {
  const normalizedSlug = options.siteSlug?.trim().toLowerCase();
  const normalizedDomain = normalizeDomain(options.domain);

  if (normalizedSlug) {
    const site = await prisma.site.findUnique({
      where: { slug: normalizedSlug },
    });
    if (site) {
      return site;
    }
  }

  if (normalizedDomain) {
    const site = await prisma.site.findUnique({
      where: { domain: normalizedDomain },
    });
    if (site) {
      return site;
    }
  }

  const fallback = await prisma.site.findFirst({
    where: { slug: DEFAULT_SITE_SLUG },
  });

  if (fallback) {
    return fallback;
  }

  const firstSite = await prisma.site.findFirst();
  if (!firstSite) {
    throw new Error(
      "No site found. Run `npm run db:seed` to create the initial site.",
    );
  }

  return firstSite;
}

function normalizeDomain(domain?: string | null) {
  if (!domain) {
    return null;
  }

  return domain.split(":")[0].toLowerCase();
}


