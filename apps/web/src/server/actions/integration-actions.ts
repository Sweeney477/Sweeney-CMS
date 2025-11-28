'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/server/auth/guards";
import {
  issueApiToken,
  revokeApiToken,
  type ApiTokenScope,
  API_TOKEN_SCOPES,
} from "@/server/services/api-token-service";
import {
  createWebhook,
  deleteWebhook,
  retryWebhookDelivery,
  updateWebhook,
} from "@/server/services/webhook-service";
import {
  reindexSite,
  updateSearchIntegrationConfig,
} from "@/server/services/search-index-service";

const scopesSchema = z
  .array(z.enum(API_TOKEN_SCOPES))
  .default(["content:read"]);

const createTokenSchema = z.object({
  siteId: z.string().cuid(),
  name: z.string().min(3),
  description: z
    .string()
    .optional()
    .transform((value) => value?.trim() || null),
  scopes: scopesSchema,
});

const revokeTokenSchema = z.object({
  tokenId: z.string().cuid(),
});

const webhookSchema = z.object({
  siteId: z.string().cuid(),
  webhookId: z.string().cuid().optional(),
  name: z.string().min(3),
  url: z.string().url(),
  secret: z
    .string()
    .optional()
    .transform((value) => value?.trim() || null),
  events: z
    .array(z.string().min(1))
    .default([])
    .transform((values) =>
      Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))),
    ),
  isEnabled: z.boolean().default(true),
});

const deleteWebhookSchema = z.object({
  webhookId: z.string().cuid(),
});

const retryDeliverySchema = z.object({
  deliveryId: z.string().cuid(),
});

const searchConfigSchema = z.object({
  siteId: z.string().cuid(),
  provider: z.enum(["NONE", "ALGOLIA", "MEILISEARCH"]),
  indexName: z
    .string()
    .optional()
    .transform((value) => value?.trim() || null),
});

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

function readScopes(formData: FormData): ApiTokenScope[] {
  const raw = formData.getAll("scopes").map((value) => String(value));
  const filtered = raw.filter((scope) =>
    API_TOKEN_SCOPES.includes(scope as ApiTokenScope),
  );
  return filtered.length ? (filtered as ApiTokenScope[]) : ["content:read"];
}

export async function createApiTokenAction(
  formData: FormData,
): Promise<ActionResult<{ secret: string; tokenId: string }>> {
  await requireUser();
  const raw = Object.fromEntries(formData);
  const parsed = createTokenSchema.safeParse({
    ...raw,
    scopes: readScopes(formData),
  });

  if (!parsed.success) {
    return { success: false, error: "Validation failed." };
  }

  const { token, secret } = await issueApiToken(parsed.data);
  revalidatePath("/admin/settings/integrations");
  return { success: true, data: { secret, tokenId: token.id } };
}

export async function revokeApiTokenAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const raw = Object.fromEntries(formData);
  const parsed = revokeTokenSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: "Validation failed." };
  }

  await revokeApiToken(parsed.data.tokenId);
  revalidatePath("/admin/settings/integrations");
  return { success: true };
}

export async function saveWebhookAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const rawEntries = Object.fromEntries(formData);
  const events = formData.getAll("events").map((value) => String(value));
  const parsed = webhookSchema.safeParse({
    ...rawEntries,
    events,
    isEnabled: rawEntries.isEnabled === "true" || rawEntries.isEnabled === "on",
  });

  if (!parsed.success) {
    return { success: false, error: "Validation failed." };
  }

  if (parsed.data.webhookId) {
    await updateWebhook(parsed.data.webhookId, {
      name: parsed.data.name,
      url: parsed.data.url,
      secret: parsed.data.secret,
      events: parsed.data.events,
      isEnabled: parsed.data.isEnabled,
    });
  } else {
    await createWebhook({
      siteId: parsed.data.siteId,
      name: parsed.data.name,
      url: parsed.data.url,
      secret: parsed.data.secret ?? undefined,
      events: parsed.data.events,
      isEnabled: parsed.data.isEnabled,
    });
  }

  revalidatePath("/admin/settings/integrations");
  return { success: true };
}

export async function deleteWebhookAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const raw = Object.fromEntries(formData);
  const parsed = deleteWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Validation failed." };
  }

  await deleteWebhook(parsed.data.webhookId);
  revalidatePath("/admin/settings/integrations");
  return { success: true };
}

export async function retryWebhookDeliveryAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const raw = Object.fromEntries(formData);
  const parsed = retryDeliverySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Validation failed." };
  }

  await retryWebhookDelivery(parsed.data.deliveryId);
  revalidatePath("/admin/settings/integrations");
  return { success: true };
}

export async function updateSearchIntegrationAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const raw = Object.fromEntries(formData);
  const parsed = searchConfigSchema.safeParse(raw);

  if (!parsed.success) {
    return { success: false, error: "Validation failed." };
  }

  await updateSearchIntegrationConfig(parsed.data.siteId, {
    provider: parsed.data.provider,
    indexName: parsed.data.indexName,
  });
  revalidatePath("/admin/settings/integrations");
  return { success: true };
}

export async function reindexSearchAction(
  formData: FormData,
): Promise<ActionResult> {
  await requireUser();
  const siteId = formData.get("siteId");
  if (typeof siteId !== "string" || !siteId) {
    return { success: false, error: "Missing siteId." };
  }

  await reindexSite(siteId);
  revalidatePath("/admin/settings/integrations");
  return { success: true };
}
