import { headers } from "next/headers";

import { AdminShell } from "@/components/admin/admin-shell";
import { NewPageForm } from "@/components/admin/new-page-form";
import { PageTable } from "@/components/admin/page-table";
import { requireUser } from "@/server/auth/guards";
import { listPages } from "@/server/services/page-service";
import { listSites, resolveActiveSite } from "@/server/services/site-service";

type PageListProps = {
  searchParams?: { site?: string };
};

export default async function PageList({ searchParams }: PageListProps) {
  await requireUser();
  const sites = await listSites();
  const currentSite = await resolveActiveSite({
    siteSlug: searchParams?.site,
    domain: headers().get("host"),
  });
  const pages = await listPages(currentSite.id);

  return (
    <AdminShell
      currentPath="/admin/pages"
      sites={sites}
      activeSite={currentSite}
    >
      <PageTable pages={pages} />
      <NewPageForm siteId={currentSite.id} />
    </AdminShell>
  );
}

