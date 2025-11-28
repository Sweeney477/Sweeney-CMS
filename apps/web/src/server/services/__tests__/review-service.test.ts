import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReviewEvent } from "@prisma/client";

vi.mock("@/server/db", () => {
  return {
    prisma: {
      reviewEvent: {
        create: vi.fn(),
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  };
});

import { prisma } from "@/server/db";
import { logReviewEvent, listReviewEvents, latestReviewDecision } from "@/server/services/review-service";

describe("review-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs review events with provided metadata", async () => {
    const mockEvent: ReviewEvent = {
      id: "event-1",
      siteId: "site-1",
      pageId: "page-1",
      revisionId: "rev-1",
      actorId: "user-1",
      type: "SUBMITTED",
      note: "Ready for review",
      createdAt: new Date(),
    };
    vi.mocked(prisma.reviewEvent.create).mockResolvedValue(mockEvent);

    const result = await logReviewEvent({
      siteId: "site-1",
      pageId: "page-1",
      revisionId: "rev-1",
      actorId: "user-1",
      type: "SUBMITTED",
      note: "Ready for review",
    });

    expect(prisma.reviewEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        siteId: "site-1",
        pageId: "page-1",
        revisionId: "rev-1",
        actorId: "user-1",
        type: "SUBMITTED",
        note: "Ready for review",
      }),
    });
    expect(result).toEqual(mockEvent);
  });

  it("lists review events ordered by date", async () => {
    vi.mocked(prisma.reviewEvent.findMany).mockResolvedValue([
      { id: "two", createdAt: new Date("2024-01-02"), actor: null },
      { id: "one", createdAt: new Date("2024-01-01"), actor: null },
    ]);

    const events = await listReviewEvents("page-1");

    expect(prisma.reviewEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pageId: "page-1" },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
    expect(events).toHaveLength(2);
    expect(events[0].id).toBe("two");
  });

  it("returns latest decision for revision", async () => {
    const latestEvent: ReviewEvent = {
      id: "latest",
      siteId: "site-1",
      pageId: "page-1",
      revisionId: "rev-1",
      actorId: "user-2",
      type: "APPROVED",
      note: null,
      createdAt: new Date(),
    };
    vi.mocked(prisma.reviewEvent.findFirst).mockResolvedValue(latestEvent);

    const event = await latestReviewDecision("rev-123");
    expect(prisma.reviewEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { revisionId: "rev-123" },
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(event).toEqual(latestEvent);
  });
});

