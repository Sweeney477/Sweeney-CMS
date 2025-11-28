import { headers } from "next/headers";

import { AdminShell } from "@/components/admin/admin-shell";
import { TokenManager } from "@/components/admin/settings/token-manager";
import { WebhookManager } from "@/components/admin/settings/webhook-manager";
import { SearchManager } from "@/components/admin/settings/search-manager";
import { requireUser } from "@/server/auth/guards";
import { listSites, resolveActiveSite } from "@/server/services/site-service";
import { listApiTokens } from "@/server/services/api-token-service";
import {
  listWebhookDeliveries,
  listWebhooks,
} from "@/server/services/webhook-service";
import { getSearchIntegration } from "@/server/services/search-index-service";

type IntegrationsPageProps = {
  searchParams?: { site?: string };
};

export default async function IntegrationsPage({
  searchParams,
}: IntegrationsPageProps) {
  await requireUser();
  const sites = await listSites();
  const requestHeaders = await headers();
  const currentSite = await resolveActiveSite({
    siteSlug: searchParams?.site,
    domain: requestHeaders.get("host") ?? undefined,
  });

  const [tokens, webhooks, deliveries, searchIntegration] = await Promise.all([
    listApiTokens(currentSite.id),
    listWebhooks(currentSite.id),
    listWebhookDeliveries(currentSite.id, 20),
    getSearchIntegration(currentSite.id),
  ]);

  return (
    <AdminShell
      currentPath="/admin/settings/integrations"
      sites={sites}
      activeSite={currentSite}
    >
      <TokenManager
        siteId={currentSite.id}
        tokens={tokens.map((token) => ({
          id: token.id,
          name: token.name,
          tokenPrefix: token.tokenPrefix,
          scopes: token.scopes,
          createdAt: token.createdAt.toISOString(),
          lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
          revokedAt: token.revokedAt?.toISOString() ?? null,
        }))}
      />
      <WebhookManager
        siteId={currentSite.id}
        webhooks={webhooks.map((webhook) => ({
          id: webhook.id,
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          isEnabled: webhook.isEnabled,
          secret: webhook.secret ?? "",
          updatedAt: webhook.updatedAt.toISOString(),
        }))}
        deliveries={deliveries.map((delivery) => ({
          id: delivery.id,
          eventType: delivery.eventType,
          status: delivery.status,
          createdAt: delivery.createdAt.toISOString(),
          deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
          responseCode: delivery.responseCode,
          errorMessage: delivery.errorMessage ?? null,
          webhookName: delivery.webhook?.name ?? "Webhook",
        }))}
      />
      <SearchManager
        siteId={currentSite.id}
        provider={searchIntegration.provider}
        indexName={searchIntegration.indexName ?? ""}
        lastSyncAt={searchIntegration.lastSyncAt?.toISOString() ?? null}
        lastError={searchIntegration.lastError ?? null}
      />
    </AdminShell>
  );
}

