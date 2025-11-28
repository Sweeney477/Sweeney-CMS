import "server-only";

import type { PublicationSource } from "@prisma/client";

import { prisma } from "@/server/db";
import { applyRevisionMetadata } from "@/server/services/metadata-service";
import { recordPublicationEvent } from "@/server/services/publication-log-service";

type ScheduledRevision = {
  id: string;
  pageId: string;
  siteId: string;
  meta: unknown;
};

export async function releaseDueRevisionForPage(siteId: string, path: string) {
  const dueRevision = await prisma.revision.findFirst({
    where: {
      page: {
        siteId,
        path,
      },
      status: "SCHEDULED",
      scheduledFor: {
        lte: new Date(),
      },
    },
    select: {
      id: true,
      pageId: true,
      meta: true,
      page: {
        select: {
          siteId: true,
        },
      },
    },
    orderBy: { scheduledFor: "asc" },
  });

  if (!dueRevision) {
    return;
  }

  if (!dueRevision.page) {
    return;
  }

  await publishScheduledRevision(
    {
      id: dueRevision.id,
      pageId: dueRevision.pageId,
      siteId: dueRevision.page.siteId,
      meta: dueRevision.meta,
    },
    "SYSTEM",
  );
}

export async function publishDueRevisions(limit = 25) {
  const dueRevisions = await prisma.revision.findMany({
    where: {
      status: "SCHEDULED",
      scheduledFor: {
        lte: new Date(),
      },
    },
    select: {
      id: true,
      pageId: true,
      meta: true,
      page: {
        select: {
          siteId: true,
        },
      },
    },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });

  let published = 0;

  for (const revision of dueRevisions) {
    try {
      if (!revision.page) {
        continue;
      }
      await publishScheduledRevision(
        {
          id: revision.id,
          pageId: revision.pageId,
          siteId: revision.page.siteId,
          meta: revision.meta,
        },
        "SCHEDULER",
      );
      published += 1;
    } catch (error) {
      console.error("Failed to publish scheduled revision", {
        revisionId: revision.id,
        error,
      });
    }
  }

  return { published };
}

async function publishScheduledRevision(
  revision: ScheduledRevision,
  source: PublicationSource,
) {
  await prisma.$transaction(async (tx) => {
    const updated = await tx.revision.update({
      where: { id: revision.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        scheduledFor: null,
        scheduledById: null,
        scheduledTimezone: null,
      },
      select: {
        pageId: true,
        meta: true,
      },
    });

    await tx.page.update({
      where: { id: revision.pageId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    await applyRevisionMetadata(tx, revision.pageId, updated.meta ?? revision.meta);
  });

  await recordPublicationEvent({
    siteId: revision.siteId,
    pageId: revision.pageId,
    revisionId: revision.id,
    actorId: null,
    action: "AUTO_PUBLISH",
    source,
  });
}

