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
import {
  createSiteDomainAction,
  deleteSiteDomainAction,
  setPrimarySiteDomainAction,
  updateSiteDomainRedirectAction,
  updateSiteSettingsAction,
} from "@/server/actions/site-actions";
import { requireUser } from "@/server/auth/guards";
import {
  listSiteDomains,
  listSites,
  resolveActiveSite,
} from "@/server/services/site-service";
import { TIMEZONES } from "@/lib/timezones";

type SettingsPageProps = {
  searchParams?: { site?: string };
};

const handleUpdateSiteSettings = async (formData: FormData) => {
  "use server";
  await updateSiteSettingsAction(formData);
};

const handleSetPrimaryDomain = async (formData: FormData) => {
  "use server";
  await setPrimarySiteDomainAction(formData);
};

const handleUpdateDomainRedirect = async (formData: FormData) => {
  "use server";
  await updateSiteDomainRedirectAction(formData);
};

const handleDeleteDomain = async (formData: FormData) => {
  "use server";
  await deleteSiteDomainAction(formData);
};

const handleCreateDomain = async (formData: FormData) => {
  "use server";
  await createSiteDomainAction(formData);
};

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  await requireUser();
  const sites = await listSites();
  const requestHeaders = await headers();
  const currentSite = await resolveActiveSite({
    siteSlug: searchParams?.site,
    domain: requestHeaders.get("host") ?? undefined,
  });
  const siteDomains = await listSiteDomains(currentSite.id);
  const primaryDomain =
    siteDomains.find((domain) => domain.isPrimary)?.domain ?? currentSite.domain;

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
          <form action={handleUpdateSiteSettings} className="space-y-4">
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={currentSite.description ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <select
                id="timezone"
                name="timezone"
                defaultValue={currentSite.timezone}
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/30"
              >
                {TIMEZONES.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Scheduling and preview timestamps use this site timezone.
              </p>
            </div>
            <Button type="submit">Save changes</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Domains & aliases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            {siteDomains.length ? (
              siteDomains.map((domain) => (
                <div
                  key={domain.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div>
                    <p className="font-mono text-sm text-slate-900">
                      {domain.domain}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {domain.isPrimary && (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                          Primary
                        </span>
                      )}
                      {!domain.isPrimary && domain.redirectToPrimary && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                          Redirects to primary
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!domain.isPrimary && (
                  <form action={handleSetPrimaryDomain}>
                        <input type="hidden" name="siteId" value={currentSite.id} />
                        <input type="hidden" name="domainId" value={domain.id} />
                        <Button variant="ghost" size="sm" type="submit">
                          Set primary
                        </Button>
                      </form>
                    )}
                  {!domain.isPrimary && (
                    <form action={handleUpdateDomainRedirect}>
                        <input type="hidden" name="siteId" value={currentSite.id} />
                        <input type="hidden" name="domainId" value={domain.id} />
                        <input
                          type="hidden"
                          name="redirectToPrimary"
                          value={(!domain.redirectToPrimary).toString()}
                        />
                        <Button variant="ghost" size="sm" type="submit">
                          {domain.redirectToPrimary ? "Disable redirect" : "Enable redirect"}
                        </Button>
                      </form>
                    )}
                  <form action={handleDeleteDomain}>
                      <input type="hidden" name="siteId" value={currentSite.id} />
                      <input type="hidden" name="domainId" value={domain.id} />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        type="submit"
                      >
                        Remove
                      </Button>
                    </form>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No custom domains yet. Add your first alias below.
              </p>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p>
              Primary domain:{" "}
              <span className="font-mono text-slate-900">
                {primaryDomain ?? "not set"}
              </span>
            </p>
            <p className="text-xs text-slate-500">
              The primary domain serves live traffic. Additional domains can redirect to the primary hostname.
            </p>
          </div>
        <form action={handleCreateDomain} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <input type="hidden" name="siteId" value={currentSite.id} />
            <div className="space-y-2">
              <Label htmlFor="newDomain">Add domain</Label>
              <Input
                id="newDomain"
                name="domain"
                placeholder="example.com"
                required
              />
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="isPrimary"
                  value="true"
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/30"
                />
                <span>Set as primary domain</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="redirectToPrimary"
                  value="true"
                  defaultChecked
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/30"
                />
                <span>Redirect visitors to the primary domain</span>
              </label>
            </div>
            <Button type="submit">Add domain</Button>
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
