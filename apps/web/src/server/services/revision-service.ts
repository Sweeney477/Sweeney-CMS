import "server-only";

import type { ContentBlock, Revision } from "@prisma/client";

import { prisma } from "@/server/db";

export type RevisionSummary = {
  id: string;
  status: Revision["status"];
  summary?: string | null;
  createdAt: Date;
  publishedAt?: Date | null;
  scheduledFor?: Date | null;
  scheduledTimezone?: string | null;
  reviewedAt?: Date | null;
  author?: {
    id: string;
    name?: string | null;
    email: string;
  };
  reviewer?: {
    id: string;
    name?: string | null;
    email: string;
  } | null;
};

export type RevisionDiff = {
  baseRevisionId: string | null;
  targetRevisionId: string;
  blocks: Array<{
    index: number;
    change: "added" | "removed" | "modified" | "unchanged";
    kind?: string;
  }>;
  metadata: Array<{
    key: string;
    change: "added" | "removed" | "modified" | "unchanged";
    before?: unknown;
    after?: unknown;
  }>;
};

export async function listRevisionTimeline(pageId: string): Promise<RevisionSummary[]> {
  const revisions = await prisma.revision.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    include: {
      author: { select: { id: true, name: true, email: true } },
      reviewer: { select: { id: true, name: true, email: true } },
    },
  });

  return revisions.map((revision) => ({
    id: revision.id,
    status: revision.status,
    summary: revision.summary,
    createdAt: revision.createdAt,
    publishedAt: revision.publishedAt,
    scheduledFor: revision.scheduledFor,
    scheduledTimezone: revision.scheduledTimezone,
    reviewedAt: revision.reviewedAt,
    author: revision.author
      ? {
          id: revision.author.id,
          name: revision.author.name,
          email: revision.author.email,
        }
      : undefined,
    reviewer: revision.reviewer
      ? {
          id: revision.reviewer.id,
          name: revision.reviewer.name,
          email: revision.reviewer.email,
        }
      : null,
  }));
}

export async function getRevisionDiff(
  targetRevisionId: string,
  compareToRevisionId?: string,
): Promise<RevisionDiff | null> {
  const target = await prisma.revision.findUnique({
    where: { id: targetRevisionId },
    include: {
      blocks: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!target) {
    return null;
  }

  const base =
    compareToRevisionId && compareToRevisionId !== targetRevisionId
      ? await prisma.revision.findFirst({
          where: { id: compareToRevisionId, pageId: target.pageId },
          include: { blocks: { orderBy: { sortOrder: "asc" } } },
        })
      : await prisma.revision.findFirst({
          where: {
            pageId: target.pageId,
            status: "PUBLISHED",
            NOT: { id: target.id },
          },
          orderBy: { createdAt: "desc" },
          include: { blocks: { orderBy: { sortOrder: "asc" } } },
        });

  return compareRevisions(base, target);
}

function compareRevisions(
  base: (Revision & { blocks: ContentBlock[] }) | null,
  target: Revision & { blocks: ContentBlock[] },
): RevisionDiff {
  const blockDiffs: RevisionDiff["blocks"] = [];

  const baseBlocks = base?.blocks ?? [];
  const targetBlocks = target.blocks;
  const max = Math.max(baseBlocks.length, targetBlocks.length);

  for (let index = 0; index < max; index += 1) {
    const baseBlock = baseBlocks[index];
    const targetBlock = targetBlocks[index];

    if (baseBlock && targetBlock) {
      const same =
        baseBlock.kind === targetBlock.kind &&
        JSON.stringify(baseBlock.data) === JSON.stringify(targetBlock.data) &&
        JSON.stringify(baseBlock.settings ?? {}) ===
          JSON.stringify(targetBlock.settings ?? {});

      blockDiffs.push({
        index,
        change: same ? "unchanged" : "modified",
        kind: targetBlock.kind,
      });
    } else if (targetBlock && !baseBlock) {
      blockDiffs.push({
        index,
        change: "added",
        kind: targetBlock.kind,
      });
    } else if (baseBlock && !targetBlock) {
      blockDiffs.push({
        index,
        change: "removed",
        kind: baseBlock.kind,
      });
    }
  }

  const metaDiffs: RevisionDiff["metadata"] = [];
  const baseMeta = normalizeMeta(base?.meta);
  const targetMeta = normalizeMeta(target.meta);

  const allMetaKeys = new Set([...Object.keys(baseMeta), ...Object.keys(targetMeta)]);
  for (const key of allMetaKeys) {
    if (!(key in baseMeta)) {
      metaDiffs.push({ key, change: "added", after: targetMeta[key] });
    } else if (!(key in targetMeta)) {
      metaDiffs.push({ key, change: "removed", before: baseMeta[key] });
    } else if (JSON.stringify(baseMeta[key]) === JSON.stringify(targetMeta[key])) {
      metaDiffs.push({ key, change: "unchanged", before: baseMeta[key], after: targetMeta[key] });
    } else {
      metaDiffs.push({
        key,
        change: "modified",
        before: baseMeta[key],
        after: targetMeta[key],
      });
    }
  }

  return {
    baseRevisionId: base?.id ?? null,
    targetRevisionId: target.id,
    blocks: blockDiffs,
    metadata: metaDiffs,
  };
}

function normalizeMeta(meta: unknown): Record<string, unknown> {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  return {};
}

