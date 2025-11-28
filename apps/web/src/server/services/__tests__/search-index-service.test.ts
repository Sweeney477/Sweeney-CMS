import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: {
    SEARCH_PROVIDER: "ALGOLIA",
    ALGOLIA_APP_ID: "",
    ALGOLIA_API_KEY: "",
    ALGOLIA_INDEX: "default-index",
    MEILISEARCH_HOST: "",
    MEILISEARCH_API_KEY: "",
    MEILISEARCH_INDEX: "",
  },
}));

vi.mock("@/server/db", () => ({
  prisma: {
    searchIntegration: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    page: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("algoliasearch", () => ({
  default: vi.fn(() => ({
    initIndex: () => ({
      saveObjects: vi.fn(),
      deleteObjects: vi.fn(),
      replaceAllObjects: vi.fn(),
    }),
  })),
}));

vi.mock("meilisearch", () => ({
  MeiliSearch: vi.fn(() => ({
    index: () => ({
      addDocuments: vi.fn(),
      deleteDocuments: vi.fn(),
      deleteAllDocuments: vi.fn(),
    }),
  })),
}));

import { prisma } from "@/server/db";
import { getSearchIntegration } from "@/server/services/search-index-service";

describe("search-index-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing integration config", async () => {
    const existing = {
      id: "integration-1",
      siteId: "site",
      provider: "ALGOLIA",
      indexName: "custom-index",
      config: {},
      lastSyncAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(prisma.searchIntegration.findUnique).mockResolvedValue(existing);

    const config = await getSearchIntegration("site");
    expect(config).toEqual(existing);
    expect(prisma.searchIntegration.create).not.toHaveBeenCalled();
  });

  it("creates default config when missing", async () => {
    const created = {
      id: "integration-2",
      siteId: "site",
      provider: "ALGOLIA",
      indexName: "default-index",
      config: {},
      lastSyncAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.searchIntegration.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.searchIntegration.create).mockResolvedValue(created);

    const config = await getSearchIntegration("site");
    expect(prisma.searchIntegration.create).toHaveBeenCalledWith({
      data: {
        siteId: "site",
        provider: "ALGOLIA",
        indexName: "default-index",
      },
    });
    expect(config).toEqual(created);
  });
});


