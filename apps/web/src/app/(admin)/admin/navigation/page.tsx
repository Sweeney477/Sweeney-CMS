import { headers } from "next/headers";

import { AdminShell } from "@/components/admin/admin-shell";
import { NavigationEditor } from "@/components/admin/navigation-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/guards";
import { listSites, resolveActiveSite } from "@/server/services/site-service";
import { getNavigationMenu } from "@/server/services/navigation-service";

type NavigationPageProps = {
  searchParams?: { site?: string };
};

export default async function NavigationPage({
  searchParams,
}: NavigationPageProps) {
  await requireUser();
  const sites = await listSites();
  const currentSite = await resolveActiveSite({
    siteSlug: searchParams?.site,
    domain: headers().get("host"),
  });
  const menu = await getNavigationMenu({
    siteId: currentSite.id,
    placement: "PRIMARY",
  });

  return (
    <AdminShell
      currentPath="/admin/navigation"
      sites={sites}
      activeSite={currentSite}
    >
      {menu ? (
        <NavigationEditor menuId={menu.id} items={menu.items} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No menu found</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500">
            Create a navigation menu using Prisma or the API, then reload this page.
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}

