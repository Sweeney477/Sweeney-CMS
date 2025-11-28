'use server';

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { DateTime } from "luxon";
import type { ActivityKind, Prisma } from "@prisma/client";

import { auth } from "@/server/auth";
import { prisma } from "@/server/db";
import { isValidTimeZone } from "@/lib/timezones";
import { recordPublicationEvent } from "@/server/services/publication-log-service";
import { logReviewEvent } from "@/server/services/review-service";

type ActionResult =
  | { success: true }
  | { success: false; error: string; issues?: Record<string, string[]> };

const targetSchema = z.object({
  pageId: z.string().cuid(),
  revisionId: z.string().cuid(),
  message: z.string().max(500).optional(),
});

const scheduleSchema = targetSchema.extend({
  scheduledAt: z.string().min(1),
  scheduledTimezone: z
    .string()
    .refine((value) => isValidTimeZone(value), { message: "Invalid timezone." }),
});

const SCHEDULE_INPUT_FORMAT = "yyyy-LL-dd'T'HH:mm";

export async function requestReviewAction(formData: FormData): Promise<ActionResult> {
  const parsed = targetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(parsed.error.flatten().fieldErrors);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const revision = await prisma.revision.findFirst({
    where: {
      id: parsed.data.revisionId,
      pageId: parsed.data.pageId,
    },
    select: {
      id: true,
      status: true,
      page: { select: { siteId: true } },
    },
  });

  if (!revision) {
    return { success: false, error: "Revision not found." };
  }

  if (revision.status !== "DRAFT") {
    return { success: false, error: "Only draft revisions can enter review." };
  }

  await prisma.$transaction([
    prisma.revision.update({
      where: { id: revision.id },
      data: {
        status: "REVIEW",
        reviewedAt: null,
        reviewedById: null,
      },
    }),
    prisma.page.update({
      where: { id: parsed.data.pageId },
      data: {
        status: "REVIEW",
      },
    }),
  ]);

  if (revision.page?.siteId) {
    await logReviewEvent({
      siteId: revision.page.siteId,
      pageId: parsed.data.pageId,
      revisionId: revision.id,
      actorId: session.user.id,
      type: "SUBMITTED",
      note: parsed.data.message,
    });
    await recordWorkflowActivity({
      siteId: revision.page.siteId,
      pageId: parsed.data.pageId,
      revisionId: revision.id,
      actorId: session.user.id,
      kind: "REVISION_SUBMITTED",
      metadata: parsed.data.message ? { note: parsed.data.message } : undefined,
    });
  }

  revalidatePath(`/admin/pages/${parsed.data.pageId}`);
  return { success: true };
}

export async function returnRevisionToDraftAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = targetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(parsed.error.flatten().fieldErrors);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const revision = await prisma.revision.findFirst({
    where: {
      id: parsed.data.revisionId,
      pageId: parsed.data.pageId,
    },
    select: { id: true, status: true, page: { select: { siteId: true } } },
  });

  if (!revision) {
    return { success: false, error: "Revision not found." };
  }

  if (revision.status === "PUBLISHED") {
    return { success: false, error: "Published revisions cannot be edited." };
  }

  await prisma.revision.update({
    where: { id: revision.id },
    data: {
      status: "DRAFT",
      reviewedAt: null,
      reviewedById: null,
      scheduledFor: null,
      scheduledById: null,
      scheduledTimezone: null,
    },
  });

  if (revision.page?.siteId) {
    await logReviewEvent({
      siteId: revision.page.siteId,
      pageId: parsed.data.pageId,
      revisionId: revision.id,
      actorId: session.user.id,
      type: "CHANGES_REQUESTED",
      note: parsed.data.message,
    });
    await recordWorkflowActivity({
      siteId: revision.page.siteId,
      pageId: parsed.data.pageId,
      revisionId: revision.id,
      actorId: session.user.id,
      kind: "REVISION_CHANGES_REQUESTED",
      metadata: parsed.data.message ? { note: parsed.data.message } : undefined,
    });
  }

  revalidatePath(`/admin/pages/${parsed.data.pageId}`);
  return { success: true };
}

export async function markRevisionReviewedAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = targetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(parsed.error.flatten().fieldErrors);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const revision = await prisma.revision.findFirst({
    where: {
      id: parsed.data.revisionId,
      pageId: parsed.data.pageId,
    },
    select: { id: true, status: true, page: { select: { siteId: true } } },
  });

  if (!revision) {
    return { success: false, error: "Revision not found." };
  }

  if (revision.status !== "REVIEW") {
    return { success: false, error: "Submit the revision for review first." };
  }

  if (revision.status !== "REVIEW") {
    return { success: false, error: "Only revisions in review can be approved." };
  }

  await prisma.revision.update({
    where: { id: revision.id },
    data: {
      reviewedAt: new Date(),
      reviewedById: session.user.id,
    },
  });

  if (revision.page?.siteId) {
    await logReviewEvent({
      siteId: revision.page.siteId,
      pageId: parsed.data.pageId,
      revisionId: revision.id,
      actorId: session.user.id,
      type: "APPROVED",
      note: parsed.data.message,
    });
    await recordWorkflowActivity({
      siteId: revision.page.siteId,
      pageId: parsed.data.pageId,
      revisionId: revision.id,
      actorId: session.user.id,
      kind: "REVISION_APPROVED",
      metadata: parsed.data.message ? { note: parsed.data.message } : undefined,
    });
  }

  revalidatePath(`/admin/pages/${parsed.data.pageId}`);
  return { success: true };
}

export async function scheduleRevisionAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(parsed.error.flatten().fieldErrors);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const scheduledAt = DateTime.fromFormat(parsed.data.scheduledAt, SCHEDULE_INPUT_FORMAT, {
    zone: parsed.data.scheduledTimezone,
  });
  if (!scheduledAt.isValid) {
    return { success: false, error: "Invalid schedule time." };
  }
  const scheduledFor = scheduledAt.toUTC();

  const revision = await prisma.revision.findFirst({
    where: {
      id: parsed.data.revisionId,
      pageId: parsed.data.pageId,
    },
    select: { id: true, status: true, page: { select: { siteId: true } } },
  });

  if (!revision) {
    return { success: false, error: "Revision not found." };
  }

  if (scheduledFor.toMillis() <= Date.now()) {
    return { success: false, error: "Schedule time must be in the future." };
  }

  await prisma.$transaction([
    prisma.revision.update({
      where: { id: revision.id },
      data: {
        status: "SCHEDULED",
          scheduledFor: scheduledFor.toJSDate(),
        scheduledById: session.user.id,
          scheduledTimezone: parsed.data.scheduledTimezone,
      },
    }),
    prisma.page.update({
      where: { id: parsed.data.pageId },
      data: {
        status: "SCHEDULED",
      },
    }),
  ]);

  if (revision.page?.siteId) {
    await recordWorkflowActivity({
      siteId: revision.page.siteId,
      pageId: parsed.data.pageId,
      revisionId: revision.id,
      actorId: session.user.id,
      kind: "REVISION_SCHEDULED",
      metadata: {
        scheduledFor: scheduledFor.toISO(),
        timezone: parsed.data.scheduledTimezone,
      },
    });
  }

  revalidatePath(`/admin/pages/${parsed.data.pageId}`);
  if (revision.page?.siteId) {
    await recordPublicationEvent({
      siteId: revision.page.siteId,
      pageId: parsed.data.pageId,
      revisionId: revision.id,
      actorId: session.user.id,
      action: "SCHEDULE",
      source: "MANUAL",
      metadata: {
        scheduledFor: scheduledFor.toUTC().toISO(),
        timezone: parsed.data.scheduledTimezone,
      },
    });
  }
  return { success: true };
}

export async function cancelScheduleAction(
  formData: FormData,
): Promise<ActionResult> {
  const parsed = targetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return invalid(parsed.error.flatten().fieldErrors);
  }

  const session = await auth();
  if (!session?.user?.id) {
    return unauthorized();
  }

  const revision = await prisma.revision.findFirst({
    where: {
      id: parsed.data.revisionId,
      pageId: parsed.data.pageId,
    },
    select: {
      id: true,
      status: true,
      scheduledFor: true,
      scheduledTimezone: true,
      page: { select: { siteId: true } },
    },
  });

  if (!revision) {
    return { success: false, error: "Revision not found." };
  }

  if (revision.status !== "SCHEDULED") {
    return { success: false, error: "Only scheduled revisions can be cancelled." };
  }

  await prisma.$transaction([
    prisma.revision.update({
      where: { id: revision.id },
      data: {
        status: "REVIEW",
        scheduledFor: null,
        scheduledById: null,
        scheduledTimezone: null,
      },
    }),
    prisma.page.update({
      where: { id: parsed.data.pageId },
      data: {
        status: "REVIEW",
      },
    }),
  ]);

  if (revision.page?.siteId) {
    await recordWorkflowActivity({
      siteId: revision.page.siteId,
      pageId: parsed.data.pageId,
      revisionId: revision.id,
      actorId: session.user.id,
      kind: "REVISION_UNSCHEDULED",
      metadata: {
        previousSchedule: revision.scheduledFor?.toISOString() ?? undefined,
      },
    });
  }

  revalidatePath(`/admin/pages/${parsed.data.pageId}`);
  if (revision.page?.siteId) {
    await recordPublicationEvent({
      siteId: revision.page.siteId,
      pageId: parsed.data.pageId,
      revisionId: revision.id,
      actorId: session.user.id,
      action: "UNSCHEDULE",
      source: "MANUAL",
      metadata: {
        scheduledFor: revision.scheduledFor?.toISOString() ?? null,
        previousTimezone: revision.scheduledTimezone ?? null,
      },
    });
  }
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

async function recordWorkflowActivity(params: {
  siteId: string;
  pageId: string;
  revisionId: string;
  actorId?: string;
  kind: ActivityKind;
  metadata?: Record<string, unknown>;
}) {
  await prisma.activityEvent.create({
    data: {
      siteId: params.siteId,
      pageId: params.pageId,
      revisionId: params.revisionId,
      actorId: params.actorId,
      kind: params.kind,
      metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
}
