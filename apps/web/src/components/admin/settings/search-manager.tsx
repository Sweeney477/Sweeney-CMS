'use client';

import { useState, useTransition } from "react";

import {
  reindexSearchAction,
  updateSearchIntegrationAction,
} from "@/server/actions/integration-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type SearchManagerProps = {
  siteId: string;
  provider: "NONE" | "ALGOLIA" | "MEILISEARCH";
  indexName: string;
  lastSyncAt: string | null;
  lastError: string | null;
};

export function SearchManager({
  siteId,
  provider,
  indexName,
  lastSyncAt,
  lastError,
}: SearchManagerProps) {
  const [state, setState] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("siteId", siteId);

    startTransition(async () => {
      setState(null);
      const result = await updateSearchIntegrationAction(formData);
      if (result.success) {
        setState({ type: "success", message: "Search settings saved." });
      } else {
        setState({ type: "error", message: result.error });
      }
    });
  };

  const handleReindex = () => {
    const formData = new FormData();
    formData.set("siteId", siteId);
    startTransition(async () => {
      setState(null);
      const result = await reindexSearchAction(formData);
      if (result.success) {
        setState({ type: "success", message: "Re-index started." });
      } else {
        setState({ type: "error", message: result.error });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search indexing</CardTitle>
        <CardDescription>
          Configure either Algolia or Meilisearch adapters and trigger re-indexing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleSave} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="search-provider">Provider</Label>
            <Select id="search-provider" name="provider" defaultValue={provider}>
              <option value="NONE">Disabled</option>
              <option value="ALGOLIA">Algolia</option>
              <option value="MEILISEARCH">Meilisearch</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="indexName">Index name</Label>
            <Input
              id="indexName"
              name="indexName"
              defaultValue={indexName}
              placeholder="e.g. sweeney_pages"
            />
          </div>
          <div className="md:col-span-2 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              <p>Last sync: {lastSyncAt ? formatDate(lastSyncAt) : "Never"}</p>
              {lastError && <p className="text-red-600">Last error: {lastError}</p>}
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={isPending}>
                Save settings
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleReindex}
                disabled={isPending}
              >
                Run full re-index
              </Button>
            </div>
          </div>
        </form>
        {state && (
          <div
            className={`rounded-md border p-3 text-sm ${
              state.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {state.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));
}


