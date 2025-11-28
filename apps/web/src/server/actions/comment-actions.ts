'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/server/auth";
import { prisma } from "@/server/db";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const createThreadSchema = z.object({
  siteId: z.string().cuid(),
  pageId: z.string().cuid(),
  revisionId: z.string().cuid(),
  blockReferenceKey: z.string().regex(uuidRegex),
  body: z.string().min(1),
});

const replySchema = z.object({
  threadId: z.string().cuid(),
  pageId: z.string().cuid(),
  body: z.string().min(1),
});

const resolveSchema = z.object({
  threadId: z.string().cuid(),
  pageId: z.string().cuid(),
  resolution: z.enum(["RESOLVE", "REOPEN"]),
});

type ActionResult =
  | { success: true }
  | { success: false; error: string; issues?: Record<string, string[]> };

export async function createCommentThreadAction(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const parsed = createThreadSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(parsed.error.flatten().fieldErrors);
  }

  const { siteId, pageId, revisionId, blockReferenceKey, body } = parsed.data;

  const revision = await prisma.revision.findFirst({
    where: { id: revisionId, pageId },
    select: { id: true },
  });

  if (!revision) {
    return { success: false, error: "Revision not found." };
  }

  const thread = await prisma.blockCommentThread.create({
    data: {
      siteId,
      pageId,
      revisionId,
      blockReferenceKey,
      status: "OPEN",
      createdById: session.user.id,
      comments: {
        create: {
          authorId: session.user.id,
          body,
        },
      },
    },
    include: { comments: true },
  });

  await prisma.activityEvent.create({
    data: {
      siteId,
      pageId,
      revisionId,
      actorId: session.user.id,
      kind: "COMMENT_ADDED",
      commentThreadId: thread.id,
      commentId: thread.comments[0]?.id,
      metadata: {
        blockReferenceKey,
      },
    },
  });

  revalidatePath(`/admin/pages/${pageId}`);
  return { success: true };
}

export async function replyToCommentThreadAction(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const parsed = replySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(parsed.error.flatten().fieldErrors);
  }

  const thread = await prisma.blockCommentThread.findUnique({
    where: { id: parsed.data.threadId },
    select: {
      id: true,
      siteId: true,
      pageId: true,
      revisionId: true,
      blockReferenceKey: true,
    },
  });

  if (!thread) {
    return { success: false, error: "Thread not found." };
  }

  const comment = await prisma.blockComment.create({
    data: {
      threadId: thread.id,
      authorId: session.user.id,
      body: parsed.data.body.trim(),
    },
  });

  await prisma.activityEvent.create({
    data: {
      siteId: thread.siteId,
      pageId: thread.pageId,
      revisionId: thread.revisionId,
      actorId: session.user.id,
      kind: "COMMENT_ADDED",
      commentThreadId: thread.id,
      commentId: comment.id,
      metadata: { blockReferenceKey: thread.blockReferenceKey },
    },
  });

  revalidatePath(`/admin/pages/${parsed.data.pageId}`);
  return { success: true };
}

export async function updateCommentThreadStatusAction(
  formData: FormData,
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const parsed = resolveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(parsed.error.flatten().fieldErrors);
  }

  const thread = await prisma.blockCommentThread.findUnique({
    where: { id: parsed.data.threadId },
    select: {
      id: true,
      siteId: true,
      pageId: true,
      revisionId: true,
      blockReferenceKey: true,
      status: true,
    },
  });

  if (!thread) {
    return { success: false, error: "Thread not found." };
  }

  const nextStatus = parsed.data.resolution === "RESOLVE" ? "RESOLVED" : "OPEN";
  if (thread.status === nextStatus) {
    return { success: true };
  }

  await prisma.blockCommentThread.update({
    where: { id: thread.id },
    data: {
      status: nextStatus,
      resolvedById: parsed.data.resolution === "RESOLVE" ? session.user.id : null,
      resolvedAt: parsed.data.resolution === "RESOLVE" ? new Date() : null,
    },
  });

  await prisma.activityEvent.create({
    data: {
      siteId: thread.siteId,
      pageId: thread.pageId,
      revisionId: thread.revisionId,
      actorId: session.user.id,
      kind: parsed.data.resolution === "RESOLVE" ? "COMMENT_RESOLVED" : "COMMENT_REOPENED",
      commentThreadId: thread.id,
      metadata: {
        blockReferenceKey: thread.blockReferenceKey,
      },
    },
  });

  revalidatePath(`/admin/pages/${parsed.data.pageId}`);
  return { success: true };
}

function invalid(issues: Record<string, string[] | undefined>): ActionResult {
  const sanitized = Object.fromEntries(
    Object.entries(issues).map(([key, value]) => [key, value ?? []]),
  ) as Record<string, string[]>;
  return {
    success: false,
    error: "Validation failed",
    issues: sanitized,
  };
}

function unauthorized(): ActionResult {
  return { success: false, error: "You must be signed in to continue." };
}


