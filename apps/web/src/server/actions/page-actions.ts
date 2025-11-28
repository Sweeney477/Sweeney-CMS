'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/server/auth";
import { prisma } from "@/server/db";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createPageSchema = z.object({
  siteId: z.string().cuid(),
  title: z.string().min(1),
  slug: z.string().regex(slugRegex, {
    message: "Use lowercase letters, numbers, and dashes only.",
  }),
});

const pageContentSchema = z.object({
  pageId: z.string().cuid(),
  heroEyebrow: z.string().optional(),
  heroHeading: z.string().min(1),
  heroBody: z.string().optional(),
  ctaLabel: z.string().optional(),
  ctaHref: z.string().optional(),
  richText: z.string().optional(),
  featureList: z.string().optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
});

const publishSchema = z.object({
  pageId: z.string().cuid(),
  revisionId: z.string().cuid().optional(),
});

type ActionResult =
  | { success: true }
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
): Promise<ActionResult> {
  const raw = Object.fromEntries(formData);
  const parsed = pageContentSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      issues: parsed.error.flatten().fieldErrors,
    };
  }

  const {
    pageId,
    heroEyebrow,
    heroHeading,
    heroBody,
    ctaLabel,
    ctaHref,
    richText,
    featureList,
    seoTitle,
    seoDescription,
  } = parsed.data;
  const session = await auth();

  await prisma.revision.create({
    data: {
      pageId,
      status: "DRAFT",
      summary: "Content update",
      authorId: session?.user?.id,
      blocks: {
        create: [
          {
            kind: "hero",
            sortOrder: 0,
            data: {
              eyebrow: heroEyebrow,
              heading: heroHeading,
              body: heroBody,
              ctaLabel,
              ctaHref,
            },
          },
          {
            kind: "rich-text",
            sortOrder: 1,
            data: {
              content: richText,
            },
          },
          {
            kind: "feature-grid",
            sortOrder: 2,
            data: {
              items: featureList
                ? featureList
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .map((value) => ({
                      title: value,
                      body: "",
                    }))
                : [],
            },
          },
        ],
      },
    },
  });

  const pageSite = await prisma.page.findUnique({
    where: { id: pageId },
    select: { siteId: true },
  });

  if (!pageSite) {
    return {
      success: false,
      error: "Page not found while saving metadata.",
    };
  }

  await Promise.all([
    upsertMetadata(pageId, pageSite.siteId, "seoTitle", seoTitle),
    upsertMetadata(pageId, pageSite.siteId, "seoDescription", seoDescription),
  ]);

  revalidatePath(`/admin/pages/${pageId}`);
  return { success: true };
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
    select: { path: true },
  });

  await prisma.$transaction([
    prisma.revision.update({
      where: { id: revision },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    }),
    prisma.page.update({
      where: { id: pageId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    }),
  ]);

  revalidatePath(`/admin/pages/${pageId}`);
  if (pageRecord?.path) {
    revalidatePath(pageRecord.path);
  }
  return { success: true };
}

async function upsertMetadata(
  pageId: string,
  siteId: string,
  key: string,
  value?: string,
) {
  const trimmed = value?.trim();
  if (!trimmed) {
    await prisma.metadata.deleteMany({
      where: { pageId, key },
    });
    return;
  }

  await prisma.metadata.upsert({
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

