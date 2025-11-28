import "server-only";

import {
  assertScopes,
  type ApiTokenScope,
  type ApiTokenWithSite,
  validateApiToken,
} from "@/server/services/api-token-service";

export class ApiTokenError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

function extractTokenFromHeaders(headers: Headers) {
  const authHeader = headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  const fallback = headers.get("x-sweeney-api-token");
  return fallback?.trim() ?? null;
}

export async function requireApiToken(
  request: Request,
  options: { requiredScopes?: ApiTokenScope[]; siteId?: string } = {},
): Promise<ApiTokenWithSite> {
  const raw = extractTokenFromHeaders(request.headers);
  if (!raw) {
    throw new ApiTokenError("Missing Authorization header.", 401);
  }

  const token = await validateApiToken(raw);
  if (!token) {
    throw new ApiTokenError("Invalid API token provided.", 401);
  }

  if (options.siteId && token.siteId !== options.siteId) {
    throw new ApiTokenError("API token cannot access this site.", 403);
  }

  if (options.requiredScopes?.length) {
    try {
      assertScopes(token, options.requiredScopes);
    } catch (error) {
      throw new ApiTokenError(
        error instanceof Error ? error.message : "Missing required scope.",
        403,
      );
    }
  }

  return token;
}

export type { ApiTokenScope, ApiTokenWithSite } from "@/server/services/api-token-service";


