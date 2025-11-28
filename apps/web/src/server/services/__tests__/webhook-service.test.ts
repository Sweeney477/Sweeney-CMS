import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({
  prisma: {
    integrationWebhook: {
      findMany: vi.fn(),
    },
    webhookDelivery: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/server/db";
import { dispatchWebhookEvent } from "@/server/services/webhook-service";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("webhook-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("skips dispatch when no webhooks enabled", async () => {
    vi.mocked(prisma.integrationWebhook.findMany).mockResolvedValue([]);

    await dispatchWebhookEvent("site", {
      type: "page.published",
      siteId: "site",
    });

    expect(prisma.integrationWebhook.findMany).toHaveBeenCalled();
    expect(prisma.webhookDelivery.create).not.toHaveBeenCalled();
  });

  it("creates deliveries and posts payloads", async () => {
    vi.mocked(prisma.integrationWebhook.findMany).mockResolvedValue([
      {
        id: "webhook-1",
        siteId: "site",
        name: "Hook",
        url: "https://example.com/webhook",
        secret: "secret",
        events: ["page.published"],
        isEnabled: true,
        headers: {},
      },
    ] as never);

    vi.mocked(prisma.webhookDelivery.create).mockResolvedValue({
      id: "delivery-1",
    } as never);

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    await dispatchWebhookEvent("site", {
      type: "page.published",
      siteId: "site",
    });

    expect(prisma.webhookDelivery.create).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
      }),
    );
    expect(prisma.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: expect.objectContaining({ status: "DELIVERED" }),
    });
  });
});


