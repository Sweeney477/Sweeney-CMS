import { headers } from "next/headers";

import { AdminShell } from "@/components/admin/admin-shell";
import { MediaLibrary } from "@/components/admin/assets/media-library";
import { requireUser } from "@/server/auth/guards";
import { listSites, resolveActiveSite } from "@/server/services/site-service";
import {
  listAssetFolders,
  listAssetTags,
  listAssets,
  mapAssetToDTO,
} from "@/server/services/asset-service";
import { env } from "@/env";

type MediaPageProps = {
  searchParams?: { site?: string };
};

export default async function MediaPage({ searchParams }: MediaPageProps) {
  await requireUser();
  const allSites = await listSites();
  const requestHeaders = await headers();
  const currentSite = await resolveActiveSite({
    siteSlug: searchParams?.site,
    domain: requestHeaders.get("host") ?? undefined,
  });

  const [folders, tags, assets] = await Promise.all([
    listAssetFolders(currentSite.id),
    listAssetTags(currentSite.id),
    listAssets({ siteId: currentSite.id, limit: 24 }),
  ]);
  const initialAssets = assets.items.map(mapAssetToDTO);

  return (
    <AdminShell
      currentPath="/admin/media"
      sites={allSites}
      activeSite={currentSite}
    >
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Media</h1>
          <p className="text-sm text-slate-500">
            Browse, organize, and annotate media assets for{" "}
            <span className="font-medium text-slate-900">
              {currentSite.name}
            </span>
            .
          </p>
        </div>
        <MediaLibrary
          siteId={currentSite.id}
          maxUploadMb={env.MAX_UPLOAD_MB}
          initialAssets={initialAssets}
          initialFolders={folders}
          initialTags={tags}
          initialCursor={assets.nextCursor}
        />
      </div>
    </AdminShell>
  );
}
