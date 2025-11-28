import "server-only";

import type { Site, SiteDomain } from "@prisma/client";

import { prisma } from "@/server/db";

export type SiteDomainSummary = Pick<
  SiteDomain,
  "id" | "domain" | "isPrimary" | "redirectToPrimary" | "label"
>;

export type SiteSummary = Pick<
  Site,
  "id" | "name" | "slug" | "domain" | "updatedAt" | "previewSecret" | "timezone"
> & {
  pageCount: number;
  primaryDomain: string | null;
  domains: SiteDomainSummary[];
};

const DEFAULT_SITE_SLUG = "primary";

export async function listSites(): Promise<SiteSummary[]> {
  const sites = await prisma.site.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      domains: {
        orderBy: [
          { isPrimary: "desc" },
          { createdAt: "asc" },
        ],
      },
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
    domain: site.domain ?? site.domains.find((d) => d.isPrimary)?.domain ?? null,
    updatedAt: site.updatedAt,
    previewSecret: site.previewSecret,
     timezone: site.timezone,
    pageCount: site._count.pages,
    primaryDomain:
      site.domains.find((domain) => domain.isPrimary)?.domain ??
      site.domain ??
      null,
    domains: site.domains.map((domain) => ({
      id: domain.id,
      domain: domain.domain,
      isPrimary: domain.isPrimary,
      redirectToPrimary: domain.redirectToPrimary,
      label: domain.label,
    })),
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
    const domainMatch = await prisma.siteDomain.findUnique({
      where: { domain: normalizedDomain },
      include: { site: true },
    });
    if (domainMatch?.site) {
      return domainMatch.site;
    }

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

export function normalizeDomain(domain?: string | null) {
  if (!domain) {
    return null;
  }

  const sanitized = domain
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split(":")[0]
    .trim()
    .toLowerCase();
  return sanitized || null;
}

export async function listSiteDomains(siteId: string) {
  return prisma.siteDomain.findMany({
    where: { siteId },
    orderBy: [
      { isPrimary: "desc" },
      { createdAt: "asc" },
    ],
  });
}


