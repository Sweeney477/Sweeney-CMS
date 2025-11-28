import type { Prisma } from "@prisma/client";
import { z } from "zod";

const absoluteUrlField = z.union([z.string().url(), z.literal("")]).optional();

export const revisionMetaSchema = z.object({
  seoTitle: z.string().max(140).optional(),
  seoDescription: z.string().max(240).optional(),
  canonicalUrl: absoluteUrlField,
  seoOgTitle: z.string().max(140).optional(),
  seoOgDescription: z.string().max(240).optional(),
  seoOgImage: absoluteUrlField,
});

export async function applyRevisionMetadata(
  tx: Prisma.TransactionClient,
  pageId: string,
  meta: unknown,
) {
  if (!meta || typeof meta !== "object") {
    return;
  }

  const revisionMeta = revisionMetaSchema.safeParse(meta);
  if (!revisionMeta.success) {
    return;
  }

  const pageSite = await tx.page.findUnique({
    where: { id: pageId },
    select: { siteId: true },
  });

  if (!pageSite) {
    return;
  }

  await Promise.all([
    upsertMetadata(tx, pageId, pageSite.siteId, "seoTitle", revisionMeta.data.seoTitle),
    upsertMetadata(
      tx,
      pageId,
      pageSite.siteId,
      "seoDescription",
      revisionMeta.data.seoDescription,
    ),
    upsertMetadata(
      tx,
      pageId,
      pageSite.siteId,
      "canonicalUrl",
      revisionMeta.data.canonicalUrl,
    ),
    upsertMetadata(tx, pageId, pageSite.siteId, "seoOgTitle", revisionMeta.data.seoOgTitle),
    upsertMetadata(
      tx,
      pageId,
      pageSite.siteId,
      "seoOgDescription",
      revisionMeta.data.seoOgDescription,
    ),
    upsertMetadata(tx, pageId, pageSite.siteId, "seoOgImage", revisionMeta.data.seoOgImage),
  ]);
}

export async function upsertMetadata(
  client: Prisma.TransactionClient,
  pageId: string,
  siteId: string,
  key: string,
  value?: string,
) {
  const trimmed = value?.trim();
  if (!trimmed) {
    await client.metadata.deleteMany({
      where: { pageId, key },
    });
    return;
  }

  await client.metadata.upsert({
    where: {
      pageId_key: {
        pageId,
        key,
      },
    },
    create: {
      pageId,
      siteId,
      key,
      value: trimmed,
    },
    update: {
      value: trimmed,
    },
  });
}

