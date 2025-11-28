import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/server/auth";
import { prisma } from "@/server/db";

const replySchema = z.object({
  body: z.string().min(1),
});

const statusSchema = z.object({
  status: z.enum(["OPEN", "RESOLVED"]),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ revisionId: string; threadId: string }> },
) {
  const params = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = replySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const thread = await prisma.blockCommentThread.findUnique({
    where: { id: params.threadId },
    select: {
      id: true,
      siteId: true,
      pageId: true,
      revisionId: true,
      blockReferenceKey: true,
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  }

  const comment = await prisma.blockComment.create({
    data: {
      threadId: thread.id,
      authorId: session.user.id,
      body: parsed.data.body,
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

  return NextResponse.json({ comment });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ revisionId: string; threadId: string }> },
) {
  const params = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = statusSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const thread = await prisma.blockCommentThread.findUnique({
    where: { id: params.threadId },
    select: {
      id: true,
      siteId: true,
      pageId: true,
      revisionId: true,
      blockReferenceKey: true,
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  }

  const updated = await prisma.blockCommentThread.update({
    where: { id: thread.id },
    data: {
      status: parsed.data.status,
      resolvedById: parsed.data.status === "RESOLVED" ? session.user.id : null,
      resolvedAt: parsed.data.status === "RESOLVED" ? new Date() : null,
    },
  });

  await prisma.activityEvent.create({
    data: {
      siteId: thread.siteId,
      pageId: thread.pageId,
      revisionId: thread.revisionId,
      actorId: session.user.id,
      kind: parsed.data.status === "RESOLVED" ? "COMMENT_RESOLVED" : "COMMENT_REOPENED",
      commentThreadId: thread.id,
      metadata: { blockReferenceKey: thread.blockReferenceKey },
    },
  });

  return NextResponse.json({ thread: updated });
}


