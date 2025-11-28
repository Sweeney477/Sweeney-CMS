'use client';

import { useRef, useState, useTransition } from "react";

import { createApiTokenAction, revokeApiTokenAction } from "@/server/actions/integration-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type TokenSummary = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

const AVAILABLE_SCOPES = [
  { value: "content:read", label: "Content (published)" },
  { value: "content:drafts", label: "Draft content" },
  { value: "search:manage", label: "Manage search index" },
];

type TokenManagerProps = {
  siteId: string;
  tokens: TokenSummary[];
};

export function TokenManager({ siteId, tokens }: TokenManagerProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("siteId", siteId);

    startTransition(async () => {
      setError(null);
      const result = await createApiTokenAction(formData);
      if (result.success) {
        setSecret(result.data?.secret ?? null);
        formRef.current?.reset();
      } else {
        setSecret(null);
        setError(result.error);
      }
    });
  };

  const revokeToken = (tokenId: string) => {
    const formData = new FormData();
    formData.append("tokenId", tokenId);
    startTransition(async () => {
      await revokeApiTokenAction(formData);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Tokens</CardTitle>
        <CardDescription>
          Issue headless API tokens for this site. Tokens are tied to a single site and scopes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">Name</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">Prefix</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">Scopes</th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">Last used</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {tokens.map((token) => (
                <tr key={token.id} className={token.revokedAt ? "opacity-60" : undefined}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{token.name}</div>
                    <div className="text-xs text-slate-500">
                      Issued {formatDate(token.createdAt)}
                      {token.revokedAt && ` · Revoked ${formatDate(token.revokedAt)}`}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {token.tokenPrefix}••••
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {token.scopes.map((scope) => (
                        <Badge key={scope} variant="outline">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {token.lastUsedAt ? formatDate(token.lastUsedAt) : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!token.revokedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => revokeToken(token.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {tokens.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">
                    No tokens yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form ref={formRef} onSubmit={handleCreate} className="space-y-4 rounded-lg border border-slate-200 p-4">
          <div className="space-y-1">
            <Label htmlFor="token-name">Token name</Label>
            <Input id="token-name" name="name" placeholder="Marketing site token" required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="token-description">Description</Label>
            <Textarea id="token-description" name="description" rows={2} placeholder="Optional note" />
          </div>
          <div className="space-y-2">
            <Label>Scopes</Label>
            <div className="grid gap-2 md:grid-cols-2">
              {AVAILABLE_SCOPES.map((scope) => (
                <label key={scope.value} className="flex gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    name="scopes"
                    value={scope.value}
                    defaultChecked={scope.value === "content:read"}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900/40"
                  />
                  <span>{scope.label}</span>
                </label>
              ))}
            </div>
          </div>
          {secret && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-semibold">Token created.</p>
              <p>
                Copy this value now—you will not be able to see it again:
                <span className="ml-2 font-mono text-xs">{secret}</span>
              </p>
            </div>
          )}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Create token"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function formatDate(isoDate: string | null) {
  if (!isoDate) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

