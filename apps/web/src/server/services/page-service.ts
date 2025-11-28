import "server-only";

import type { Page, Revision } from "@prisma/client";
import { cache } from "react";

import { prisma } from "@/server/db";
import { releaseDueRevisionForPage } from "@/server/services/scheduler-service";
import {
  blockDataSchema,
  blockSettingsSchema,
  type BlockPayload,
  type BlockSettings,
} from "@/lib/blocks";

type LegacyBlock = {
  id?: string;
  kind: string;
  data: Record<string, unknown>;
  settings: BlockSettings;
};

type ParsedBlock = BlockPayload | LegacyBlock;

export type RenderableBlock = ParsedBlock & {
  id: string;
  sortOrder: number;
  referenceKey: string;
  recordId: string;
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
    timezone: string;
  };
  metadata: Record<string, unknown>;
  blocks: RenderableBlock[];
  revision?: Pick<
    Revision,
    "id" | "status" | "summary" | "createdAt" | "scheduledFor" | "scheduledTimezone" | "reviewedAt"
  > & { meta?: Record<string, unknown> };
};

export const getRenderablePage = cache(
  async (options: {
    siteId: string;
    path: string;
    includeDraft?: boolean;
    revisionId?: string;
  }): Promise<RenderablePage | null> => {
    await releaseDueRevisionForPage(options.siteId, options.path);

    const page = await prisma.page.findFirst({
      where: { siteId: options.siteId, path: options.path },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            slug: true,
            timezone: true,
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

    const pageMetadata = Object.fromEntries(
      page.metadata.map((m) => [m.key, parseJson(m.value)]),
    );
    const revisionMeta = options.includeDraft && activeRevision
      ? normalizeMeta(activeRevision.meta)
      : undefined;
    const mergedMetadata =
      revisionMeta && options.includeDraft
        ? {
            ...pageMetadata,
            ...revisionMeta,
          }
        : pageMetadata;

    return {
      id: page.id,
      title: page.title,
      path: page.path,
      status: page.status,
      publishedAt: page.publishedAt,
      site: page.site,
      metadata: mergedMetadata,
      blocks: blocksSource.map((block) => {
        const parsed = parseBlock({
          id: block.referenceKey ?? block.id,
          kind: block.kind,
          data: block.data,
          settings: block.settings,
        });
        const referenceKey =
          (parsed.id as string | undefined) ?? block.referenceKey ?? block.id;
        return {
          ...parsed,
          id: referenceKey,
          referenceKey,
          recordId: block.id,
          sortOrder: block.sortOrder,
        };
      }),
      revision: activeRevision
        ? {
            id: activeRevision.id,
            status: activeRevision.status,
            summary: activeRevision.summary ?? null,
            createdAt: activeRevision.createdAt,
            scheduledFor: activeRevision.scheduledFor ?? null,
            scheduledTimezone: activeRevision.scheduledTimezone ?? null,
            reviewedAt: activeRevision.reviewedAt ?? null,
            meta: revisionMeta ?? {},
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

function parseJson(raw: unknown) {
  if (raw === null || typeof raw === "undefined") {
    return null;
  }

  return raw;
}

function normalizeMeta(meta: unknown) {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  return undefined;
}

function parseBlock(block: {
  id?: string;
  kind: string;
  data: unknown;
  settings: unknown;
}): ParsedBlock {
  const settingsResult = blockSettingsSchema.safeParse({
    ...(block.settings && typeof block.settings === "object" ? block.settings : {}),
  });

  const parsedSettings = settingsResult.success
    ? settingsResult.data
    : blockSettingsSchema.parse({
        background: "default",
        alignment: "left",
        fullWidth: false,
      });

  const result = blockDataSchema.safeParse({
    id: block.id,
    kind: block.kind,
    data: block.data,
    settings: parsedSettings,
  });

  if (result.success) {
    return result.data;
  }

  return {
    id: block.id,
    kind: block.kind,
    data:
      block.data && typeof block.data === "object"
        ? (block.data as Record<string, unknown>)
        : {},
    settings: parsedSettings,
  };
}
