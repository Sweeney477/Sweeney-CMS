import { notFound } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { PageEditorForm } from "@/components/admin/page-editor-form";
import { RevisionPanel } from "@/components/admin/revision-panel";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/auth/guards";
import { getRenderablePage } from "@/server/services/page-service";
import { listRevisionTimeline } from "@/server/services/revision-service";
import { listReviewEvents } from "@/server/services/review-service";
import { listSites } from "@/server/services/site-service";
import { prisma } from "@/server/db";
import { listPublicationLog } from "@/server/services/publication-log-service";
import { listPageActivity } from "@/server/services/activity-service";

type PageEditorProps = {
  params: Promise<{ pageId: string }>;
};

export default async function PageEditor({ params }: PageEditorProps) {
  await requireUser();
  const { pageId } = await params;
  const pageRecord = await prisma.page.findUnique({
    where: { id: pageId },
    include: {
      site: true,
    },
  });

  if (!pageRecord) {
    notFound();
  }

  const sites = await listSites();
  const currentSite = pageRecord.site;

  const page = await getRenderablePage({
    siteId: pageRecord.siteId,
    path: pageRecord.path,
    includeDraft: true,
  });

  if (!page) {
    notFound();
  }

  const revisions = await listRevisionTimeline(page.id);
  const reviewEvents = await listReviewEvents(page.id);
  const reviewEventsForClient = reviewEvents.map((event) => ({
    id: event.id,
    type: event.type,
    note: event.note ?? null,
    createdAt: event.createdAt.toISOString(),
    actor: event.actor
      ? {
          id: event.actor.id,
          name: event.actor.name,
          email: event.actor.email,
        }
      : null,
  }));
  const publicationLog = await listPublicationLog(page.id);
  const publicationLogForClient = publicationLog.map((entry) => ({
    id: entry.id,
    action: entry.action,
    source: entry.source,
    occurredAt: entry.occurredAt.toISOString(),
    metadata: entry.metadata,
    actor: entry.actor
      ? {
          id: entry.actor.id,
          name: entry.actor.name,
          email: entry.actor.email,
        }
      : null,
    revision: entry.revision
      ? {
          id: entry.revision.id,
          summary: entry.revision.summary,
        }
      : null,
  }));
  const activityFeed = await listPageActivity(page.id, { limit: 25 });
  const activityFeedForClient = activityFeed.map((item) => ({
    id: item.id,
    kind: item.kind,
    siteId: item.siteId,
    pageId: item.pageId,
    revisionId: item.revisionId,
    metadata: item.metadata ?? {},
    source: item.source,
    occurredAt: item.occurredAt.toISOString(),
    actor: item.actor
      ? {
          id: item.actor.id,
          name: item.actor.name,
          email: item.actor.email,
        }
      : null,
  }));

  return (
    <AdminShell
      currentPath={`/admin/pages/${page.id}`}
      sites={sites}
      activeSite={currentSite}
    >
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>{page.title}</CardTitle>
            <p className="text-sm text-slate-500">{page.path}</p>
          </div>
          <Badge variant="outline">{page.status.toLowerCase()}</Badge>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          <p>Site: {page.site.name}</p>
          <p>Revision: {page.revision?.status ?? "None"}</p>
        </CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <PageEditorForm page={page} />
        <RevisionPanel
          pageId={page.id}
          pagePath={page.path}
          siteSlug={page.site.slug}
          siteTimezone={page.site.timezone}
          pageStatus={page.status}
          currentRevisionId={page.revision?.id}
          revisions={revisions}
          publicationLog={publicationLogForClient}
          reviewEvents={reviewEventsForClient}
          activityFeed={activityFeedForClient}
        />
      </div>
    </AdminShell>
  );
}
