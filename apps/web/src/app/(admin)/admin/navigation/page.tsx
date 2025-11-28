import { headers } from "next/headers";
import type { NavigationPlacement } from "@prisma/client";

import { AdminShell } from "@/components/admin/admin-shell";
import { NavigationEditor } from "@/components/admin/navigation-editor";
import { NavigationPlacementSelect } from "@/components/admin/navigation-placement-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/guards";
import { listPages } from "@/server/services/page-service";
import { listSites, resolveActiveSite } from "@/server/services/site-service";
import { getNavigationMenu } from "@/server/services/navigation-service";

const PLACEMENT_OPTIONS: { label: string; value: NavigationPlacement }[] = [
  { label: "Primary navigation", value: "PRIMARY" },
  { label: "Secondary navigation", value: "SECONDARY" },
  { label: "Footer navigation", value: "FOOTER" },
  { label: "Custom navigation", value: "CUSTOM" },
];

type NavigationPageProps = {
  searchParams?: { site?: string; placement?: string };
};

export default async function NavigationPage({
  searchParams,
}: NavigationPageProps) {
  await requireUser();
  const sites = await listSites();
  const requestHeaders = await headers();
  const currentSite = await resolveActiveSite({
    siteSlug: searchParams?.site,
    domain: requestHeaders.get("host") ?? undefined,
  });

  const activePlacement = resolvePlacement(searchParams?.placement);
  const menu = await getNavigationMenu({
    siteId: currentSite.id,
    placement: activePlacement,
  });
  const pageList = await listPages(currentSite.id);
  const pageOptions = pageList.map((page) => ({
    id: page.id,
    title: page.title,
    path: page.path,
  }));

  return (
    <AdminShell
      currentPath="/admin/navigation"
      sites={sites}
      activeSite={currentSite}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Menu builder
          </h1>
          <p className="text-sm text-slate-500">
            Switch placements to manage secondary or footer navigation.
          </p>
        </div>
        <NavigationPlacementSelect
          options={PLACEMENT_OPTIONS}
          value={activePlacement}
        />
      </div>

      {menu ? (
        <NavigationEditor
          menuId={menu.id}
          items={menu.items}
          pages={pageOptions}
          placement={activePlacement}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No menu found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-500">
            <p>
              There is no navigation menu for the{" "}
              <strong>{activePlacement.toLowerCase()}</strong> placement yet.
            </p>
            <p>
              Create one via Prisma or the API, then reload this page to start
              editing.
            </p>
          </CardContent>
        </Card>
      )}
    </AdminShell>
  );
}

function resolvePlacement(
  placement?: string,
): NavigationPlacement {
  const normalized = placement?.toUpperCase();
  const match = PLACEMENT_OPTIONS.find(
    (option) => option.value === normalized,
  );
  return match?.value ?? "PRIMARY";
}
