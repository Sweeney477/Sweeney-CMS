import "server-only";

import type { Prisma, ReviewEvent, ReviewEventType } from "@prisma/client";

import { prisma } from "@/server/db";

type ReviewClient = Prisma.TransactionClient | typeof prisma;

export type ReviewEventInput = {
  siteId: string;
  pageId: string;
  revisionId: string;
  actorId?: string;
  type: ReviewEventType;
  note?: string;
  occurredAt?: Date;
};

export type ReviewEventWithActor = ReviewEvent & {
  actor: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
};

export async function logReviewEvent(
  input: ReviewEventInput,
  client: ReviewClient = prisma,
): Promise<ReviewEvent> {
  return client.reviewEvent.create({
    data: {
      siteId: input.siteId,
      pageId: input.pageId,
      revisionId: input.revisionId,
      actorId: input.actorId,
      type: input.type,
      note: input.note,
      createdAt: input.occurredAt ?? new Date(),
    },
  });
}

export async function listReviewEvents(
  pageId: string,
  options?: { limit?: number },
): Promise<ReviewEventWithActor[]> {
  const events = await prisma.reviewEvent.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 50,
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  return events;
}

export async function latestReviewDecision(
  revisionId: string,
): Promise<ReviewEventWithActor | null> {
  return prisma.reviewEvent.findFirst({
    where: { revisionId },
    orderBy: { createdAt: "desc" },
    include: {
      actor: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });
}



