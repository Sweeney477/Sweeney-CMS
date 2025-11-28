import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/env", () => ({
  env: {
    HEADLESS_API_TOKEN_SALT: "unit-test-salt",
  },
}));

vi.mock("@/server/db", () => ({
  prisma: {
    apiToken: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/server/db";
import {
  generateRawApiToken,
  hashApiToken,
  hasScope,
  issueApiToken,
  validateApiToken,
} from "@/server/services/api-token-service";

describe("api-token-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  vi.mocked(prisma.apiToken.update).mockResolvedValue(null as never);
  });

  it("hashes token deterministically", () => {
    const token = "abc123";
    const hashOne = hashApiToken(token);
    const hashTwo = hashApiToken(token);
    expect(hashOne).toBe(hashTwo);
  });

  it("issues a token and returns the raw secret once", async () => {
    const fakeToken = {
      id: "token-1",
      siteId: "site",
      name: "Token",
      description: null,
      tokenHash: "hash",
      tokenPrefix: "token",
      scopes: ["content:read"],
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.mocked(prisma.apiToken.create).mockResolvedValue(fakeToken);

    const result = await issueApiToken({
      siteId: "site",
      name: "Token",
      scopes: ["content:read"],
    });

    expect(prisma.apiToken.create).toHaveBeenCalled();
    expect(result.token).toEqual(fakeToken);
    expect(result.secret).toHaveLength(generateRawApiToken().length);
  });

  it("validates a token and updates last used timestamp", async () => {
    const tokenRecord = {
      id: "token-1",
      siteId: "site",
      name: "Token",
      description: null,
      tokenHash: hashApiToken("secret"),
      tokenPrefix: "secret",
      scopes: ["content:read"],
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      site: {
        id: "site",
        slug: "primary",
        name: "Primary",
        timezone: "UTC",
      },
    };

    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue(tokenRecord);

    const token = await validateApiToken("secret");
    await Promise.resolve();

    expect(token?.id).toBe("token-1");
    expect(prisma.apiToken.update).toHaveBeenCalledWith({
      where: { id: "token-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it("returns null when token is revoked", async () => {
    vi.mocked(prisma.apiToken.findUnique).mockResolvedValue({
      revokedAt: new Date(),
    } as never);

    const token = await validateApiToken("secret");
    expect(token).toBeNull();
  });

  it("checks for scopes", () => {
    expect(hasScope({ scopes: ["content:read"] }, "content:read")).toBe(true);
    expect(hasScope({ scopes: ["content:read"] }, "search:manage")).toBe(false);
  });
});

