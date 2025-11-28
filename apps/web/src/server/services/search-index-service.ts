import "server-only";

import { algoliasearch, type SearchClient } from "algoliasearch";
import type { Prisma } from "@prisma/client";
import { MeiliSearch, type Index as MeiliIndex } from "meilisearch";

import { env } from "@/env";
import { prisma } from "@/server/db";

type SearchRecord = {
  objectID: string;
  pageId: string;
  siteId: string;
  siteSlug: string;
  siteName: string;
  path: string;
  title: string;
  status: string;
  publishedAt?: string | null;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

type SearchAdapter = {
  save(objects: SearchRecord[], indexName: string): Promise<void>;
  delete(objectIds: string[], indexName: string): Promise<void>;
  replace(objects: SearchRecord[], indexName: string): Promise<void>;
};

let algoliaClient: SearchClient | null = null;
let meilisearchClient: MeiliSearch | null = null;

function getAlgoliaAdapter(): SearchAdapter | null {
  if (!env.ALGOLIA_APP_ID || !env.ALGOLIA_API_KEY) {
    return null;
  }
  if (!algoliaClient) {
    algoliaClient = algoliasearch(env.ALGOLIA_APP_ID, env.ALGOLIA_API_KEY);
  }
  return {
    async save(objects, indexName) {
      await algoliaClient!.saveObjects({ indexName, objects });
    },
    async delete(objectIds, indexName) {
      await algoliaClient!.deleteObjects({ indexName, objectIDs: objectIds });
    },
    async replace(objects, indexName) {
      await algoliaClient!.replaceAllObjects({ indexName, objects });
    },
  };
}

function getMeilisearchAdapter(): SearchAdapter | null {
  if (!env.MEILISEARCH_HOST || !env.MEILISEARCH_API_KEY) {
    return null;
  }
  if (!meilisearchClient) {
    meilisearchClient = new MeiliSearch({
      host: env.MEILISEARCH_HOST,
      apiKey: env.MEILISEARCH_API_KEY,
    });
  }

  const getIndex = (indexName: string): MeiliIndex => {
    return meilisearchClient!.index(indexName);
  };

  return {
    async save(objects, indexName) {
      await getIndex(indexName).addDocuments(objects, { primaryKey: "objectID" });
    },
    async delete(objectIds, indexName) {
      await getIndex(indexName).deleteDocuments(objectIds);
    },
    async replace(objects, indexName) {
      const index = getIndex(indexName);
      await index.deleteAllDocuments();
      if (objects.length) {
        await index.addDocuments(objects, { primaryKey: "objectID" });
      }
    },
  };
}

function getAdapter(provider: "NONE" | "ALGOLIA" | "MEILISEARCH"): SearchAdapter | null {
  if (provider === "ALGOLIA") {
    return getAlgoliaAdapter();
  }
  if (provider === "MEILISEARCH") {
    return getMeilisearchAdapter();
  }
  return null;
}

async function ensureSearchConfig(siteId: string) {
  const existing = await prisma.searchIntegration.findUnique({
    where: { siteId },
  });
  if (existing) {
    return existing;
  }

  return prisma.searchIntegration.create({
    data: {
      siteId,
      provider: env.SEARCH_PROVIDER,
      indexName:
        env.ALGOLIA_INDEX ??
        env.MEILISEARCH_INDEX ??
        `sweeney_${siteId}_pages`,
    },
  });
}

async function buildRecord(pageId: string): Promise<SearchRecord | null> {
  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: {
      id: true,
      siteId: true,
      title: true,
      path: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      site: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
      metadata: {
        select: {
          key: true,
          value: true,
        },
      },
    },
  });

  if (!page || page.status !== "PUBLISHED") {
    return null;
  }

  const metadata = page.metadata.reduce<Record<string, unknown>>(
    (acc, entry) => {
      acc[entry.key] = entry.value;
      return acc;
    },
    {},
  );

  return {
    objectID: `${page.site.slug}:${page.path}`,
    pageId: page.id,
    siteId: page.siteId,
    siteSlug: page.site.slug,
    siteName: page.site.name,
    path: page.path,
    title: page.title,
    status: page.status,
    publishedAt: page.publishedAt?.toISOString() ?? null,
    metadata,
    updatedAt: page.updatedAt.toISOString(),
  };
}

export async function syncPublishedPage(pageId: string) {
  const record = await buildRecord(pageId);
  if (!record) {
    return;
  }

  const config = await ensureSearchConfig(record.siteId);
  if (!config.indexName) {
    return;
  }

  const adapter = getAdapter(config.provider);
  if (!adapter) {
    return;
  }

  try {
    await adapter.save([record], config.indexName);
    await prisma.searchIntegration.update({
      where: { id: config.id },
      data: { lastSyncAt: new Date(), lastError: null },
    });
  } catch (error) {
    await prisma.searchIntegration.update({
      where: { id: config.id },
      data: {
        lastError: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

export async function removePageFromIndex(pageId: string, siteId: string) {
  const config = await ensureSearchConfig(siteId);
  if (!config.indexName) {
    return;
  }
  const adapter = getAdapter(config.provider);
  if (!adapter) {
    return;
  }

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    select: {
      path: true,
      site: {
        select: {
          slug: true,
        },
      },
    },
  });

  if (!page) {
    return;
  }

  const objectId = `${page.site.slug}:${page.path}`;

  try {
    await adapter.delete([objectId], config.indexName);
  } catch (error) {
    await prisma.searchIntegration.update({
      where: { id: config.id },
      data: {
        lastError: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

export async function reindexSite(siteId: string) {
  const config = await ensureSearchConfig(siteId);
  if (!config.indexName) {
    return;
  }
  const adapter = getAdapter(config.provider);
  if (!adapter) {
    return;
  }

  const pages = await prisma.page.findMany({
    where: { siteId, status: "PUBLISHED" },
    orderBy: { updatedAt: "desc" },
  });

  const records: SearchRecord[] = [];
  for (const page of pages) {
    const record = await buildRecord(page.id);
    if (record) {
      records.push(record);
    }
  }

  try {
    await adapter.replace(records, config.indexName);
    await prisma.searchIntegration.update({
      where: { id: config.id },
      data: { lastSyncAt: new Date(), lastError: null },
    });
  } catch (error) {
    await prisma.searchIntegration.update({
      where: { id: config.id },
      data: {
        lastError: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

export async function getSearchIntegration(siteId: string) {
  return ensureSearchConfig(siteId);
}

export async function updateSearchIntegrationConfig(
  siteId: string,
  data: { provider?: "NONE" | "ALGOLIA" | "MEILISEARCH"; indexName?: string | null; config?: Record<string, unknown> },
) {
  const existing = await ensureSearchConfig(siteId);
  return prisma.searchIntegration.update({
    where: { id: existing.id },
    data: {
      provider: data.provider ?? existing.provider,
      indexName: data.indexName ?? existing.indexName,
      config: (data.config ?? existing.config) as Prisma.InputJsonValue,
    },
  });
}
