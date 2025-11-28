import type { Metadata } from "next";
import { draftMode, headers } from "next/headers";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { PageRenderer } from "@/components/site/page-renderer";
import { env } from "@/env";
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
  const page = await getRenderablePage({
    siteId: site.id,
    path,
    includeDraft: preview,
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
  props: SitePageProps
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

  const page = await getRenderablePage({
    siteId: site.id,
    path,
    includeDraft: preview,
  });

  if (!page) {
    return {
      title: site.name,
    };
  }

  const title =
    (typeof page.metadata.seoTitle === "string" && page.metadata.seoTitle) ||
    page.title;
  const description =
    typeof page.metadata.seoDescription === "string"
      ? page.metadata.seoDescription
      : undefined;

  const canonical = new URL(path, env.NEXT_PUBLIC_APP_URL).toString();

  return {
    title,
    description,
    alternates: {
      canonical,
    },
  };
}

function buildPath(slug?: string[]) {
  if (!slug || slug.length === 0) {
    return "/";
  }
  return `/${slug.join("/")}`;
}


