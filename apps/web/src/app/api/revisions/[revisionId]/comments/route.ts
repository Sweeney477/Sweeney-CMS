import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/server/auth";
import { prisma } from "@/server/db";

const createSchema = z.object({
  blockReferenceKey: z.string().uuid(),
  body: z.string().min(1),
});

export async function GET(
  _: NextRequest,
  context: { params: Promise<{ revisionId: string }> },
) {
  const params = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const threads = await prisma.blockCommentThread.findMany({
    where: { revisionId: params.revisionId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true, image: true } },
      resolvedBy: { select: { id: true, name: true, email: true, image: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, email: true, image: true } },
        },
      },
    },
  });

  return NextResponse.json({ threads });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ revisionId: string }> },
) {
  const params = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const revision = await prisma.revision.findUnique({
    where: { id: params.revisionId },
    select: { id: true, pageId: true, page: { select: { siteId: true } } },
  });

  if (!revision?.page) {
    return NextResponse.json({ error: "Revision not found." }, { status: 404 });
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const thread = await prisma.blockCommentThread.create({
    data: {
      siteId: revision.page.siteId,
      pageId: revision.pageId,
      revisionId: revision.id,
      blockReferenceKey: parsed.data.blockReferenceKey,
      createdById: session.user.id,
      status: "OPEN",
      comments: {
        create: {
          authorId: session.user.id,
          body: parsed.data.body,
        },
      },
    },
    include: {
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true, image: true } } },
      },
      createdBy: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  await prisma.activityEvent.create({
    data: {
      siteId: revision.page.siteId,
      pageId: revision.pageId,
      revisionId: revision.id,
      actorId: session.user.id,
      kind: "COMMENT_ADDED",
      commentThreadId: thread.id,
      commentId: thread.comments[0]?.id,
      metadata: { blockReferenceKey: parsed.data.blockReferenceKey },
    },
  });

  return NextResponse.json({ thread });
}
