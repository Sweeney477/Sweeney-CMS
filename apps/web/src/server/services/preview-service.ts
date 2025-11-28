import "server-only";

import crypto from "node:crypto";

import { prisma } from "@/server/db";

const DEFAULT_PREVIEW_HOURS = 72;

export type RevisionPreviewTokenSummary = {
  id: string;
  token: string;
  expiresAt: Date;
  revoked: boolean;
  revokedAt: Date | null;
  createdAt: Date;
};

export async function listRevisionPreviewTokens(revisionId: string): Promise<RevisionPreviewTokenSummary[]> {
  return prisma.revisionPreviewToken.findMany({
    where: { revisionId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      expiresAt: true,
      revoked: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

export async function createRevisionPreviewToken(options: {
  revisionId: string;
  createdById?: string;
  expiresAt?: Date;
}): Promise<RevisionPreviewTokenSummary> {
  const revision = await prisma.revision.findUnique({
    where: { id: options.revisionId },
    select: {
      id: true,
      pageId: true,
      page: {
        select: {
          siteId: true,
        },
      },
    },
  });

  if (!revision || !revision.page) {
    throw new Error("Revision not found.");
  }

  const expiresAt =
    options.expiresAt ??
    new Date(Date.now() + DEFAULT_PREVIEW_HOURS * 60 * 60 * 1000);

  const tokenValue = buildTokenValue();

  const record = await prisma.revisionPreviewToken.create({
    data: {
      token: tokenValue,
      revisionId: revision.id,
      pageId: revision.pageId,
      siteId: revision.page.siteId,
      createdById: options.createdById,
      expiresAt,
    },
    select: {
      id: true,
      token: true,
      expiresAt: true,
      revoked: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  return record;
}

export async function revokeRevisionPreviewToken(options: {
  revisionId: string;
  tokenId: string;
}): Promise<RevisionPreviewTokenSummary | null> {
  const existing = await prisma.revisionPreviewToken.findFirst({
    where: {
      id: options.tokenId,
      revisionId: options.revisionId,
    },
  });

  if (!existing) {
    return null;
  }

  if (existing.revoked) {
    return existing;
  }

  return prisma.revisionPreviewToken.update({
    where: { id: existing.id },
    data: {
      revoked: true,
      revokedAt: new Date(),
    },
    select: {
      id: true,
      token: true,
      expiresAt: true,
      revoked: true,
      revokedAt: true,
      createdAt: true,
    },
  });
}

export async function resolvePreviewToken(token: string) {
  return prisma.revisionPreviewToken.findFirst({
    where: {
      token,
      revoked: false,
      expiresAt: {
        gt: new Date(),
      },
    },
    select: {
      id: true,
      token: true,
      expiresAt: true,
      revisionId: true,
      page: {
        select: {
          id: true,
          path: true,
          siteId: true,
          site: {
            select: {
              id: true,
              slug: true,
            },
          },
        },
      },
    },
  });
}

export type ResolvedPreviewToken = Awaited<ReturnType<typeof resolvePreviewToken>>;

function buildTokenValue() {
  return `ptk_${crypto.randomBytes(16).toString("hex")}`;
}

