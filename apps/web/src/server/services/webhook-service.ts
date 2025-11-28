import "server-only";

import { createHmac } from "node:crypto";

import type { IntegrationWebhook, Prisma } from "@prisma/client";

import { prisma } from "@/server/db";

export type WebhookDispatchPayload = {
  type: string;
  siteId: string;
  pageId?: string;
  revisionId?: string | null;
  data?: Record<string, unknown>;
};

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;

export async function listWebhooks(siteId: string) {
  return prisma.integrationWebhook.findMany({
    where: { siteId },
    orderBy: { createdAt: "asc" },
  });
}

export async function listWebhookDeliveries(siteId: string, limit = 25) {
  return prisma.webhookDelivery.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      webhook: {
        select: {
          id: true,
          name: true,
          url: true,
        },
      },
    },
  });
}

export async function createWebhook(input: {
  siteId: string;
  name: string;
  url: string;
  secret?: string | null;
  events: string[];
  isEnabled?: boolean;
  headers?: Record<string, string>;
}) {
  return prisma.integrationWebhook.create({
    data: {
      siteId: input.siteId,
      name: input.name,
      url: input.url,
      secret: input.secret ?? null,
      events: input.events,
      isEnabled: input.isEnabled ?? false,
      headers: (input.headers ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function updateWebhook(webhookId: string, input: Partial<IntegrationWebhook>) {
  return prisma.integrationWebhook.update({
    where: { id: webhookId },
    data: {
      name: input.name,
      url: input.url,
      secret: input.secret,
      events: input.events,
      isEnabled: input.isEnabled,
      headers: input.headers as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function deleteWebhook(webhookId: string) {
  await prisma.webhookDelivery.deleteMany({
    where: { webhookId },
  });
  return prisma.integrationWebhook.delete({ where: { id: webhookId } });
}

export async function dispatchWebhookEvent(
  siteId: string,
  payload: WebhookDispatchPayload,
) {
  const webhooks = await prisma.integrationWebhook.findMany({
    where: { siteId, isEnabled: true },
  });

  if (!webhooks.length) {
    return;
  }

  await Promise.all(
    webhooks
      .filter((webhook) =>
        webhook.events.length ? webhook.events.includes(payload.type) : true,
      )
      .map((webhook) => sendDelivery(webhook, payload)),
  );
}

export async function retryWebhookDelivery(deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      webhook: true,
    },
  });

  if (!delivery || !delivery.webhook || !delivery.webhook.isEnabled) {
    throw new Error("Delivery or webhook not found.");
  }

  const payload =
    typeof delivery.payload === "object" && delivery.payload
      ? (delivery.payload as WebhookDispatchPayload)
      : null;

  if (!payload) {
    throw new Error("Delivery payload is not available for retry.");
  }

  await prisma.webhookDelivery.delete({ where: { id: deliveryId } });
  await sendDelivery(delivery.webhook, payload);
}

async function sendDelivery(
  webhook: IntegrationWebhook,
  payload: WebhookDispatchPayload,
) {
  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      siteId: webhook.siteId,
      eventType: payload.type,
      payload: payload as Prisma.InputJsonValue,
    },
  });

  const body = JSON.stringify({
    type: payload.type,
    siteId: payload.siteId,
    pageId: payload.pageId,
    revisionId: payload.revisionId,
    data: payload.data ?? {},
    sentAt: new Date().toISOString(),
  });

  const headers = new Headers({
    "content-type": "application/json",
    "user-agent": "Sweeney-CMS/1.0 webhook",
    "x-sweeney-event": payload.type,
    "x-sweeney-site": payload.siteId,
  });

  if (webhook.secret) {
    const signature = createHmac("sha256", webhook.secret).update(body).digest("hex");
    headers.set("x-sweeney-signature", signature);
  }

  if (webhook.headers && typeof webhook.headers === "object") {
    Object.entries(webhook.headers as Record<string, unknown>).forEach(
      ([key, value]) => {
        if (typeof value === "string") {
          headers.set(key, value);
        }
      },
    );
  }

  let attempt = 0;
  let response: Response | null = null;
  let lastError: unknown;

  while (attempt < MAX_ATTEMPTS) {
    attempt += 1;
    try {
      response = await fetch(webhook.url, {
        method: "POST",
        headers,
        body,
      });

      if (response.ok) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "DELIVERED",
            deliveredAt: new Date(),
            responseCode: response.status,
            attemptCount: attempt,
          },
        });
        return;
      }

      lastError = new Error(
        `Received status ${response.status} from webhook target.`,
      );
    } catch (error) {
      lastError = error;
    }

    const nextRetryAt = new Date(Date.now() + attempt * BASE_DELAY_MS);
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        attemptCount: attempt,
        status: attempt >= MAX_ATTEMPTS ? "FAILED" : "PENDING",
        nextRetryAt: attempt >= MAX_ATTEMPTS ? null : nextRetryAt,
        responseCode: response?.status ?? null,
        errorMessage:
          lastError instanceof Error ? lastError.message : "Unknown error",
      },
    });

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) =>
        setTimeout(resolve, attempt * BASE_DELAY_MS),
      );
    }
  }
}
