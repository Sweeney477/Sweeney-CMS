import { NextRequest } from "next/server";
import { createYoga } from "graphql-yoga";

import { schema } from "@/lib/graphql/schema";
import { ApiTokenError, requireApiToken } from "@/server/auth/api-token";

const yoga = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  context: async ({ request }) => {
    try {
      const auth = await requireApiToken(request, {
        requiredScopes: ["content:read"],
      });
      return { auth };
    } catch (error) {
      if (error instanceof ApiTokenError) {
        throw new Response(
          JSON.stringify({
            errors: [{ message: error.message }],
          }),
          {
            status: error.status,
            headers: { "content-type": "application/json" },
          },
        );
      }
      throw error;
    }
  },
});

export async function GET(request: NextRequest) {
  return yoga.handleRequest(request, {});
}

export async function POST(request: NextRequest) {
  return yoga.handleRequest(request, {});
}

