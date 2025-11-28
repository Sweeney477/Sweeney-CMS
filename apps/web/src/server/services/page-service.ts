import "server-only";

import type { Page, Revision } from "@prisma/client";
import { cache } from "react";
import { z } from "zod";

import { prisma } from "@/server/db";

export type RenderableBlock = {
  id: string;
  kind: string;
  sortOrder: number;
  data: Record<string, unknown>;
};

export type RenderablePage = {
  id: string;
  title: string;
  path: string;
  status: Page["status"];
  publishedAt: Page["publishedAt"];
  site: {
    id: string;
    name: string;
    slug: string;
  };
  metadata: Record<string, unknown>;
  blocks: RenderableBlock[];
  revision?: Pick<Revision, "id" | "status" | "summary" | "createdAt">;
};

const contentSchema = z.record(z.any()).optional();

export const getRenderablePage = cache(
  async (options: {
    siteId: string;
    path: string;
    includeDraft?: boolean;
    revisionId?: string;
  }): Promise<RenderablePage | null> => {
    const page = await prisma.page.findFirst({
      where: { siteId: options.siteId, path: options.path },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        metadata: true,
        revisions: {
          where: options.includeDraft
            ? options.revisionId
              ? { id: options.revisionId }
              : {}
            : { status: "PUBLISHED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            blocks: {
              orderBy: { sortOrder: "asc" },
            },
          },
        },
        blocks: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!page) {
      return null;
    }

    const activeRevision = page.revisions[0];
    const blocksSource = activeRevision?.blocks?.length
      ? activeRevision.blocks
      : page.blocks;

    return {
      id: page.id,
      title: page.title,
      path: page.path,
      status: page.status,
      publishedAt: page.publishedAt,
      site: page.site,
      metadata: Object.fromEntries(
        page.metadata.map((m) => [m.key, parseJson(m.value)]),
      ),
      blocks: blocksSource.map((block) => ({
        id: block.id,
        kind: block.kind,
        sortOrder: block.sortOrder,
        data: parseBlockData(block.data),
      })),
      revision: activeRevision
        ? {
            id: activeRevision.id,
            status: activeRevision.status,
            summary: activeRevision.summary ?? undefined,
            createdAt: activeRevision.createdAt,
          }
        : undefined,
    };
  },
);

export async function listPages(siteId: string) {
  return prisma.page.findMany({
    where: { siteId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      path: true,
      status: true,
      updatedAt: true,
      publishedAt: true,
    },
  });
}

function parseBlockData(raw: unknown) {
  const parsed = contentSchema.safeParse(raw);
  if (!parsed.success) {
    return {};
  }
  return parsed.data ?? {};
}

function parseJson(raw: unknown) {
  if (raw === null || typeof raw === "undefined") {
    return null;
  }

  return raw;
}

