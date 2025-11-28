import "server-only";

import type { ActivityEvent, ActivityKind, PublicationLog } from "@prisma/client";

import { prisma } from "@/server/db";

export type ActivityFeedKind =
  | ActivityKind
  | `PUBLICATION_${PublicationLog["action"]}`;

export type ActivityFeedItem = {
  id: string;
  kind: ActivityFeedKind;
  occurredAt: Date;
  siteId: string;
  pageId: string;
  revisionId?: string | null;
  metadata?: Record<string, unknown>;
  source: "activity" | "publication";
  actor?: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
};

export async function listPageActivity(
  pageId: string,
  options?: { limit?: number },
): Promise<ActivityFeedItem[]> {
  const limit = options?.limit ?? 25;
  const [events, publications] = await Promise.all([
    prisma.activityEvent.findMany({
      where: { pageId },
      orderBy: { occurredAt: "desc" },
      take: limit,
      include: {
        actor: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    }),
    prisma.publicationLog.findMany({
      where: { pageId },
      orderBy: { occurredAt: "desc" },
      take: limit,
      include: {
        actor: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    }),
  ]);

  return mergeActivity(events, publications).slice(0, limit);
}

export async function listSiteActivity(
  siteId: string,
  options?: { limit?: number },
): Promise<ActivityFeedItem[]> {
  const limit = options?.limit ?? 50;
  const [events, publications] = await Promise.all([
    prisma.activityEvent.findMany({
      where: { siteId },
      orderBy: { occurredAt: "desc" },
      take: limit,
      include: {
        actor: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    }),
    prisma.publicationLog.findMany({
      where: { siteId },
      orderBy: { occurredAt: "desc" },
      take: limit,
      include: {
        actor: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    }),
  ]);

  return mergeActivity(events, publications).slice(0, limit);
}

function mergeActivity(
  events: Array<ActivityEvent & { actor: ActivityFeedItem["actor"] }>,
  publications: Array<PublicationLog & { actor: ActivityFeedItem["actor"] }>,
): ActivityFeedItem[] {
  const mappedEvents: ActivityFeedItem[] = events.map((event) => ({
    id: event.id,
    kind: event.kind,
    occurredAt: event.occurredAt,
    siteId: event.siteId,
    pageId: event.pageId,
    revisionId: event.revisionId,
    metadata: (event.metadata ?? {}) as Record<string, unknown>,
    source: "activity",
    actor: event.actor,
  }));

  const mappedPublications: ActivityFeedItem[] = publications.map((log) => ({
    id: log.id,
    kind: `PUBLICATION_${log.action}` as ActivityFeedKind,
    occurredAt: log.occurredAt,
    siteId: log.siteId,
    pageId: log.pageId,
    revisionId: log.revisionId,
    metadata: (log.metadata ?? {}) as Record<string, unknown>,
    source: "publication",
    actor: log.actor,
  }));

  return [...mappedEvents, ...mappedPublications]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}

