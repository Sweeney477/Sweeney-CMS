import type { Metadata } from "next";
import { cookies, draftMode, headers } from "next/headers";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { PageRenderer } from "@/components/site/page-renderer";
import { env } from "@/env";
import { decodePreviewCookie, PREVIEW_REVISION_COOKIE } from "@/lib/preview";
import { getNavigationMenu } from "@/server/services/navigation-service";
import { getRenderablePage } from "@/server/services/page-service";
import { resolveActiveSite } from "@/server/services/site-service";

export const revalidate = 60;

type SitePageProps = {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<{ site?: string }>;
};

export default async function SitePage(props: SitePageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { isEnabled: preview } = await draftMode();

  if (preview) {
    noStore();
  }

  const headersList = await headers();
  const site = await resolveActiveSite({
    siteSlug: searchParams?.site,
    domain: headersList.get("host"),
  });

  const path = buildPath(params.slug);
  const cookieStore = await cookies();
  const allowedRevision = decodePreviewCookie(
    cookieStore.get(PREVIEW_REVISION_COOKIE)?.value,
  );
  const revisionIdForPreview =
    preview && allowedRevision?.siteId === site.id
      ? allowedRevision.revisionId
      : undefined;
  const page = await getRenderablePage({
    siteId: site.id,
    path,
    includeDraft: preview,
    revisionId: revisionIdForPreview,
  });

  if (!page) {
    notFound();
  }

  const navigation = await getNavigationMenu({
    siteId: site.id,
    placement: "PRIMARY",
  });

  return (
    <PageRenderer
      page={page}
      navigation={navigation?.items}
      isPreview={preview}
    />
  );
}

export async function generateMetadata(
  props: SitePageProps,
): Promise<Metadata> {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const headersList = await headers();
  const site = await resolveActiveSite({
    siteSlug: searchParams?.site,
    domain: headersList.get("host"),
  });
  const path = buildPath(params.slug);
  const { isEnabled: preview } = await draftMode();
  const cookieStore = await cookies();
  const allowedRevision = decodePreviewCookie(
    cookieStore.get(PREVIEW_REVISION_COOKIE)?.value,
  );

  const page = await getRenderablePage({
    siteId: site.id,
    path,
    includeDraft: preview,
    revisionId:
      preview && allowedRevision?.siteId === site.id
        ? allowedRevision.revisionId
        : undefined,
  });

  if (!page) {
    return {
      title: site.name,
    };
  }

  const baseUrl = site.domain
    ? `https://${site.domain}`
    : env.NEXT_PUBLIC_APP_URL;

  const title =
    (typeof page.metadata.seoTitle === "string" && page.metadata.seoTitle) ||
    page.title;
  const description =
    typeof page.metadata.seoDescription === "string" &&
      page.metadata.seoDescription
      ? (page.metadata.seoDescription as string)
      : undefined;
  const canonicalOverride =
    typeof page.metadata.canonicalUrl === "string" &&
      page.metadata.canonicalUrl
      ? (page.metadata.canonicalUrl as string)
      : undefined;

  const canonical = canonicalOverride ?? new URL(path, baseUrl).toString();
  const openGraphTitle =
    (typeof page.metadata.seoOgTitle === "string" && page.metadata.seoOgTitle) ||
    title;
  const openGraphDescription =
    (typeof page.metadata.seoOgDescription === "string" &&
      page.metadata.seoOgDescription) ||
    description ||
    undefined;
  const openGraphImage =
    typeof page.metadata.seoOgImage === "string" && page.metadata.seoOgImage
      ? (page.metadata.seoOgImage as string)
      : undefined;

  return {
    title,
    description,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical,
    },
    openGraph: {
      title: openGraphTitle,
      description: openGraphDescription,
      url: canonical,
      siteName: site.name,
      type: "website",
      images: openGraphImage ? [{ url: openGraphImage }] : undefined,
    },
    twitter: {
      card: openGraphImage ? "summary_large_image" : "summary",
      title: openGraphTitle,
      description: openGraphDescription,
      images: openGraphImage ? [openGraphImage] : undefined,
    },
  };
}

function buildPath(slug?: string[]) {
  if (!slug || slug.length === 0) {
    return "/";
  }
  return `/${slug.join("/")}`;
}


