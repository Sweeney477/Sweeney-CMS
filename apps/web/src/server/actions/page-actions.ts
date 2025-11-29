'use server';

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { blockDataSchema } from "@/lib/blocks";
import { applyRevisionMetadata, revisionMetaSchema } from "@/server/services/metadata-service";
import { recordPublicationEvent } from "@/server/services/publication-log-service";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createPageSchema = z.object({
  siteId: z.string().cuid(),
  title: z.string().min(1),
  slug: z.string().regex(slugRegex, {
    message: "Use lowercase letters, numbers, and dashes only.",
  }),
});

const blocksPayloadSchema = z.array(blockDataSchema).min(1);

const savePageSchema = z.object({
  pageId: z.string().cuid(),
  revisionId: z.string().cuid().optional(),
  summary: z.string().max(140).optional(),
  blocks: z.string().min(2),
  metadata: z.string().optional(),
});

const publishSchema = z.object({
  pageId: z.string().cuid(),
  revisionId: z.string().cuid().optional(),
});

const unpublishSchema = z.object({
  pageId: z.string().cuid(),
});

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string; issues?: Record<string, string[]> };

export async function createPageAction(formData: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = createPageSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  const { siteId, title, slug } = parsed.data;
  const path = `/${slug}`;

  const existingPage = await prisma.page.findFirst({
    where: {
      siteId,
      OR: [
        { slug },
        { path },
      ],
    },
  });

  if (existingPage) {
    return {
      success: false,
      error: "A page with this slug already exists for this site.",
      issues: {
        slug: ["This slug is already in use. Please choose a different one."],
      },
    };
  }

  await prisma.page.create({
    data: {
      siteId,
      title,
      slug,
      path,
      status: "DRAFT",
    },
  });

  revalidatePath("/admin/pages");
  return { success: true };
}

export async function savePageContentAction(
  formData: FormData,
): Promise<ActionResult<{ revisionId: string }>> {
  const raw = Object.fromEntries(formData);
  const parsed = savePageSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  const blocksInput = safeJson(parsed.data.blocks);
  const metadataInput = parsed.data.metadata
    ? safeJson(parsed.data.metadata)
    : {};

  const blocks = blocksPayloadSchema.safeParse(blocksInput);
  const meta = revisionMetaSchema.safeParse(metadataInput);

  if (!blocks.success || !meta.success) {
    return {
      success: false,
      error: "Validation failed",
      issues: {
        blocks: blocks.success ? [] : ["Invalid block payload"],
        metadata: meta.success ? [] : ["Invalid metadata"],
      },
    };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "You must be signed in to save content.",
    };
  }

  const draftRevision = await resolveDraftRevision(
    parsed.data.pageId,
    parsed.data.revisionId,
  );

  const revision = draftRevision
    ? await prisma.revision.update({
        where: { id: draftRevision.id },
        data: {
          summary: parsed.data.summary ?? draftRevision.summary ?? "Draft update",
          meta: meta.data,
        },
      })
    : await prisma.revision.create({
        data: {
          pageId: parsed.data.pageId,
          status: "DRAFT",
          summary: parsed.data.summary ?? "Draft update",
          authorId: session.user.id,
          meta: meta.data,
        },
      });

  await prisma.contentBlock.deleteMany({
    where: { revisionId: revision.id },
  });

  await prisma.contentBlock.createMany({
    data: blocks.data.map((block, index) => {
      const referenceKey =
        typeof block.id === "string" && block.id.length > 0 ? block.id : randomUUID();
      return {
        pageId: parsed.data.pageId,
        revisionId: revision.id,
        kind: block.kind,
        sortOrder: index,
        data: block.data,
        settings: block.settings,
        referenceKey,
      };
    }),
  });

  revalidatePath(`/admin/pages/${parsed.data.pageId}`);
  return { success: true, data: { revisionId: revision.id } };
}

export async function publishPageAction(
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = publishSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  const { pageId, revisionId } = parsed.data;

  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "You must be signed in to publish.",
    };
  }

  const revision =
    revisionId ??
    (
      await prisma.revision.findFirst({
        where: {
          pageId,
          status: "DRAFT",
        },
        orderBy: { createdAt: "desc" },
      })
    )?.id;

  if (!revision) {
    return {
      success: false,
      error: "No draft revision found to publish.",
    };
  }

  const pageRecord = await prisma.page.findUnique({
    where: { id: pageId },
    select: { path: true, siteId: true },
  });

  await prisma.$transaction(async (tx) => {
    const updatedRevision = await tx.revision.update({
      where: { id: revision },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        scheduledFor: null,
        scheduledById: null,
        scheduledTimezone: null,
      },
    });

    await tx.page.update({
      where: { id: pageId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    await applyRevisionMetadata(tx, pageId, updatedRevision.meta);
  });

  revalidatePath(`/admin/pages/${pageId}`);
  if (pageRecord?.path) {
    revalidatePath(pageRecord.path);
  }

  if (pageRecord?.siteId) {
    await recordPublicationEvent({
      siteId: pageRecord.siteId,
      pageId,
      revisionId: revision,
      actorId: session.user.id,
      action: "PUBLISH",
      source: "MANUAL",
    });
    await prisma.activityEvent.create({
      data: {
        siteId: pageRecord.siteId,
        pageId,
        revisionId: revision,
        actorId: session.user.id,
        kind: "REVISION_PUBLISHED",
      },
    });
  }
  return { success: true };
}

export async function unpublishPageAction(
  formData: FormData,
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = unpublishSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  const session = await auth();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "You must be signed in to unpublish.",
    };
  }

  const page = await prisma.page.findUnique({
    where: { id: parsed.data.pageId },
    select: { id: true, path: true, siteId: true },
  });

  if (!page) {
    return { success: false, error: "Page not found." };
  }

  const latestPublished = await prisma.revision.findFirst({
    where: { pageId: page.id, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!latestPublished) {
    return { success: false, error: "Nothing to unpublish." };
  }

  await prisma.$transaction([
    prisma.revision.updateMany({
      where: { pageId: page.id, status: "PUBLISHED" },
      data: { status: "REVIEW" },
    }),
    prisma.page.update({
      where: { id: page.id },
      data: {
        status: "REVIEW",
        publishedAt: null,
      },
    }),
  ]);

  revalidatePath(`/admin/pages/${page.id}`);
  if (page.path) {
    revalidatePath(page.path);
  }

  await recordPublicationEvent({
    siteId: page.siteId,
    pageId: page.id,
    revisionId: latestPublished.id,
    actorId: session.user.id,
    action: "UNPUBLISH",
    source: "MANUAL",
  });

  return { success: true };
}

async function resolveDraftRevision(pageId: string, revisionId?: string) {
  if (revisionId) {
    const revision = await prisma.revision.findFirst({
      where: { id: revisionId, pageId, status: "DRAFT" },
    });
    if (revision) {
      return revision;
    }
  }

  return prisma.revision.findFirst({
    where: { pageId, status: "DRAFT" },
    orderBy: { createdAt: "desc" },
  });
}

function safeJson(payload: string) {
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
