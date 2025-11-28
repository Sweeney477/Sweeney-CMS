import "server-only";

import type { PublicationAction } from "@prisma/client";

import { removePageFromIndex, syncPublishedPage } from "@/server/services/search-index-service";
import { dispatchWebhookEvent } from "@/server/services/webhook-service";

type DispatchOptions = {
  siteId: string;
  pageId: string;
  revisionId?: string | null;
  action: PublicationAction;
  metadata?: Record<string, unknown>;
};

const actionEventMap: Record<PublicationAction, string | null> = {
  PUBLISH: "page.published",
  AUTO_PUBLISH: "page.published",
  UNPUBLISH: "page.unpublished",
  SCHEDULE: "revision.scheduled",
  UNSCHEDULE: "revision.unscheduled",
};

export async function enqueueIntegrationDispatch(options: DispatchOptions) {
  const tasks: Promise<unknown>[] = [];
  const eventType = actionEventMap[options.action];

  if (eventType) {
    tasks.push(
      dispatchWebhookEvent(options.siteId, {
        type: eventType,
        siteId: options.siteId,
        pageId: options.pageId,
        revisionId: options.revisionId,
        data: options.metadata ?? {},
      }),
    );
  }

  if (options.action === "PUBLISH" || options.action === "AUTO_PUBLISH") {
    tasks.push(syncPublishedPage(options.pageId));
  } else if (options.action === "UNPUBLISH") {
    tasks.push(removePageFromIndex(options.pageId, options.siteId));
  }

  if (!tasks.length) {
    return;
  }

  await Promise.allSettled(
    tasks.map((task) =>
      task.catch((error) => {
        console.error("Integration dispatch failed", {
          siteId: options.siteId,
          pageId: options.pageId,
          action: options.action,
          error,
        });
      }),
    ),
  );
}


