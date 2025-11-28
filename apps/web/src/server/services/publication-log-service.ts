import "server-only";

import type { PublicationAction, PublicationSource, Prisma } from "@prisma/client";

import { prisma } from "@/server/db";
import { enqueueIntegrationDispatch } from "@/server/services/integration-dispatcher";

export type PublicationLogEntry = {
  id: string;
  action: PublicationAction;
  source: PublicationSource;
  occurredAt: Date;
  metadata: Record<string, unknown>;
  actor?: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  revision?: {
    id: string;
    summary: string | null;
  } | null;
};

type RecordEventOptions = {
  siteId: string;
  pageId: string;
  revisionId?: string | null;
  actorId?: string | null;
  action: PublicationAction;
  source?: PublicationSource;
  metadata?: Record<string, unknown>;
};

export async function recordPublicationEvent(options: RecordEventOptions) {
  const { metadata, source = "MANUAL", ...rest } = options;
  const entry = await prisma.publicationLog.create({
    data: {
      ...rest,
      source,
      metadata: (metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  void enqueueIntegrationDispatch({
    siteId: rest.siteId,
    pageId: rest.pageId,
    revisionId: rest.revisionId,
    action: rest.action,
    metadata,
  }).catch((error) => {
    console.error("Failed to dispatch integration hooks", {
      siteId: rest.siteId,
      pageId: rest.pageId,
      action: rest.action,
      error,
    });
  });

  return entry;
}

export async function listPublicationLog(
  pageId: string,
  limit = 15,
): Promise<PublicationLogEntry[]> {
  const events = await prisma.publicationLog.findMany({
    where: { pageId },
    orderBy: { occurredAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      source: true,
      occurredAt: true,
      metadata: true,
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      revision: {
        select: {
          id: true,
          summary: true,
        },
      },
    },
  });

  return events.map((event) => ({
    id: event.id,
    action: event.action,
    source: event.source,
    occurredAt: event.occurredAt,
    metadata:
      event.metadata && typeof event.metadata === "object"
        ? (event.metadata as Record<string, unknown>)
        : {},
    actor: event.actor,
    revision: event.revision,
  }));
}
