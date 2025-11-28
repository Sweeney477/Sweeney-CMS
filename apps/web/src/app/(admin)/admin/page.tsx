import { headers } from "next/headers";

import { AdminShell } from "@/components/admin/admin-shell";
import { NavigationEditor } from "@/components/admin/navigation-editor";
import { NewPageForm } from "@/components/admin/new-page-form";
import { PageTable } from "@/components/admin/page-table";
import { StatsGrid } from "@/components/admin/stats-grid";
import { requireUser } from "@/server/auth/guards";
import { listSites, resolveActiveSite } from "@/server/services/site-service";
import { listPages } from "@/server/services/page-service";
import { getNavigationMenu } from "@/server/services/navigation-service";

type AdminPageProps = {
  searchParams?: { site?: string };
};

export default async function AdminDashboard({ searchParams }: AdminPageProps) {
  await requireUser();
  const sites = await listSites();
  const currentSite = await resolveActiveSite({
    siteSlug: searchParams?.site,
    domain: headers().get("host"),
  });
  const pages = await listPages(currentSite.id);
  const menu = await getNavigationMenu({
    siteId: currentSite.id,
    placement: "PRIMARY",
  });

  const stats = [
    {
      label: "Pages",
      value: sites.find((s) => s.id === currentSite.id)?.pageCount ?? 0,
      description: "Total published and draft pages",
    },
    {
      label: "Primary Nav Items",
      value: menu?.items.length ?? 0,
      description: "Visible links in the header",
    },
    {
      label: "Site slug",
      value: currentSite.slug,
      description: "Used for previews and API lookups",
    },
    {
      label: "Last updated",
      value: currentSite.updatedAt.toLocaleDateString(),
    },
  ];

  return (
    <AdminShell
      currentPath="/admin"
      sites={sites}
      activeSite={currentSite}
    >
      <StatsGrid stats={stats} />
      <PageTable pages={pages} />
      {menu && <NavigationEditor menuId={menu.id} items={menu.items} />}
      <NewPageForm siteId={currentSite.id} />
    </AdminShell>
  );
}

