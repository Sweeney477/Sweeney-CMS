import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({
  prisma: {
    activityEvent: {
      findMany: vi.fn(),
    },
    publicationLog: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/server/db";
import { listPageActivity } from "@/server/services/activity-service";

describe("activity-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges activity and publication logs sorted by time", async () => {
    vi.mocked(prisma.activityEvent.findMany).mockResolvedValue([
      {
        id: "activity-1",
        siteId: "site",
        pageId: "page",
        revisionId: "rev",
        actorId: "user",
        kind: "REVISION_SUBMITTED",
        metadata: {},
        occurredAt: new Date("2024-01-02T12:00:00Z"),
        actor: null,
      },
    ]);
    vi.mocked(prisma.publicationLog.findMany).mockResolvedValue([
      {
        id: "log-1",
        siteId: "site",
        pageId: "page",
        revisionId: "rev",
        actorId: "user",
        action: "PUBLISH",
        source: "MANUAL",
        metadata: {},
        occurredAt: new Date("2024-01-03T12:00:00Z"),
        actor: null,
      },
    ]);

    const feed = await listPageActivity("page");

    expect(prisma.activityEvent.findMany).toHaveBeenCalled();
    expect(prisma.publicationLog.findMany).toHaveBeenCalled();
    expect(feed).toHaveLength(2);
    expect(feed[0].id).toBe("log-1");
    expect(feed[1].id).toBe("activity-1");
  });
});

