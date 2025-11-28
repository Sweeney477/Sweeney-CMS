import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { ApiToken, Site } from "@prisma/client";

import { env } from "@/env";
import { prisma } from "@/server/db";

export const API_TOKEN_SCOPES = [
  "content:read",
  "content:drafts",
  "search:manage",
] as const;

export type ApiTokenScope = (typeof API_TOKEN_SCOPES)[number];

type SiteSummary = Pick<Site, "id" | "slug" | "name" | "timezone">;
export type ApiTokenWithSite = ApiToken & { site: SiteSummary };

const TOKEN_BYTE_LENGTH = 24;
const TOKEN_PREFIX_LENGTH = 8;

export function generateRawApiToken() {
  return randomBytes(TOKEN_BYTE_LENGTH).toString("hex");
}

export function hashApiToken(raw: string) {
  return createHash("sha256")
    .update(`${raw}.${env.HEADLESS_API_TOKEN_SALT}`)
    .digest("hex");
}

export async function issueApiToken(options: {
  siteId: string;
  name: string;
  description?: string | null;
  scopes: ApiTokenScope[];
}): Promise<{ token: ApiToken; secret: string }> {
  const secret = generateRawApiToken();
  const token = await prisma.apiToken.create({
    data: {
      siteId: options.siteId,
      name: options.name,
      description: options.description ?? null,
      tokenHash: hashApiToken(secret),
      tokenPrefix: secret.slice(0, TOKEN_PREFIX_LENGTH),
      scopes: options.scopes,
    },
  });

  return { token, secret };
}

export async function listApiTokens(siteId: string) {
  return prisma.apiToken.findMany({
    where: { siteId },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeApiToken(tokenId: string) {
  return prisma.apiToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });
}

export async function validateApiToken(rawToken: string) {
  const tokenHash = hashApiToken(rawToken);
  const token = await prisma.apiToken.findUnique({
    where: { tokenHash },
    include: {
      site: {
        select: {
          id: true,
          slug: true,
          name: true,
          timezone: true,
        },
      },
    },
  });

  if (!token || token.revokedAt) {
    return null;
  }

  queueMicrotask(() => {
    prisma.apiToken
      .update({
        where: { id: token.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((error) => {
        console.error("Failed to update API token usage timestamp", error);
      });
  });

  return token;
}

export function hasScope(token: Pick<ApiToken, "scopes">, scope: ApiTokenScope) {
  return token.scopes.includes(scope);
}

export function assertScopes(
  token: Pick<ApiToken, "scopes">,
  scopes: ApiTokenScope[],
) {
  const missing = scopes.filter((scope) => !hasScope(token, scope));
  if (missing.length) {
    throw new Error(
      `API token is missing required scope(s): ${missing.join(", ")}`,
    );
  }
}


