import { headers } from "next/headers";

import { AdminShell } from "@/components/admin/admin-shell";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { NewPageForm } from "@/components/admin/new-page-form";
import { PageTable } from "@/components/admin/page-table";
import { requireUser } from "@/server/auth/guards";
import { listPages } from "@/server/services/page-service";
import { listSites, resolveActiveSite } from "@/server/services/site-service";
import { listSiteActivity } from "@/server/services/activity-service";

type PageListProps = {
  searchParams?: { site?: string };
};

export default async function PageList({ searchParams }: PageListProps) {
  await requireUser();
  const sites = await listSites();
  const requestHeaders = await headers();
  const currentSite = await resolveActiveSite({
    siteSlug: searchParams?.site,
    domain: requestHeaders.get("host") ?? undefined,
  });
  const pages = await listPages(currentSite.id);
  const activity = await listSiteActivity(currentSite.id, { limit: 15 });
  const activityForClient = activity.map((item) => ({
    id: item.id,
    kind: item.kind,
    occurredAt: item.occurredAt.toISOString(),
    actor: item.actor
      ? {
          id: item.actor.id,
          name: item.actor.name,
          email: item.actor.email,
        }
      : null,
    metadata: item.metadata ?? {},
  }));

  return (
    <AdminShell
      currentPath="/admin/pages"
      sites={sites}
      activeSite={currentSite}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="space-y-6">
          <PageTable pages={pages} />
          <NewPageForm siteId={currentSite.id} />
        </div>
        <ActivityFeed title="Site activity" items={activityForClient} />
      </div>
    </AdminShell>
  );
}
