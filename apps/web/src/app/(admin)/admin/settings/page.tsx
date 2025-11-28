import { headers } from "next/headers";

import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateSiteSettingsAction } from "@/server/actions/site-actions";
import { requireUser } from "@/server/auth/guards";
import { listSites, resolveActiveSite } from "@/server/services/site-service";

type SettingsPageProps = {
  searchParams?: { site?: string };
};

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  await requireUser();
  const sites = await listSites();
  const currentSite = await resolveActiveSite({
    siteSlug: searchParams?.site,
    domain: headers().get("host"),
  });

  return (
    <AdminShell
      currentPath="/admin/settings"
      sites={sites}
      activeSite={currentSite}
    >
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateSiteSettingsAction} className="space-y-4">
            <input type="hidden" name="siteId" value={currentSite.id} />
            <div className="space-y-2">
              <Label htmlFor="name">Site name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={currentSite.name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Custom domain</Label>
              <Input
                id="domain"
                name="domain"
                defaultValue={currentSite.domain ?? ""}
                placeholder="example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={currentSite.description ?? ""}
              />
            </div>
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Preview secret</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>
            Use this secret to generate preview URLs. Share the preview link
            instead of draft URLs to keep unpublished work private.
          </p>
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs">
            {currentSite.previewSecret}
          </div>
        </CardContent>
      </Card>
    </AdminShell>
  );
}

