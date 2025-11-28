import { GraphQLScalarType, Kind, type ValueNode } from "graphql";
import { createSchema } from "graphql-yoga";

import { type ApiTokenWithSite } from "@/server/auth/api-token";
import { prisma } from "@/server/db";
import { getRenderablePage } from "@/server/services/page-service";
import { getSiteBySlug } from "@/server/services/site-service";

export type GraphQLContext = {
  auth: ApiTokenWithSite;
};

const JSONScalar = new GraphQLScalarType({
  name: "JSON",
  description: "Arbitrary JSON value",
  serialize(value) {
    return value ?? null;
  },
  parseValue(value) {
    return value;
  },
  parseLiteral(ast) {
    return parseAst(ast);
  },
});

const typeDefs = /* GraphQL */ `
  scalar JSON

  type Query {
    page(site: String!, path: String!, draft: Boolean = false): Page
    pages(site: String!, limit: Int = 25, offset: Int = 0): [PageSummary!]!
  }

  type Page {
    id: ID!
    title: String!
    path: String!
    status: String!
    publishedAt: String
    metadata: JSON!
    blocks: [Block!]!
  }

  type Block {
    id: ID!
    kind: String!
    sortOrder: Int!
    data: JSON
    settings: JSON
  }

  type PageSummary {
    id: ID!
    title: String!
    path: String!
    status: String!
    publishedAt: String
    updatedAt: String!
  }
`;

type PageArgs = { site: string; path: string; draft?: boolean };
type PagesArgs = { site: string; limit?: number; offset?: number };

export const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers: {
    JSON: JSONScalar,
    Query: {
      async page(_root, args: PageArgs, ctx) {
        const site = await getSiteBySlug(args.site);
        if (!site) {
          throw new Error("Site not found.");
        }
        ensureSiteAccess(ctx.auth, site.id);
        const includeDraft =
          Boolean(args.draft) && ctx.auth.scopes.includes("content:drafts");
        return getRenderablePage({
          siteId: site.id,
          path: args.path,
          includeDraft,
        });
      },
      async pages(_root, args: PagesArgs, ctx) {
        const site = await getSiteBySlug(args.site);
        if (!site) {
          throw new Error("Site not found.");
        }
        ensureSiteAccess(ctx.auth, site.id);
        const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
        const offset = Math.max(args.offset ?? 0, 0);

        const pages = await prisma.page.findMany({
          where: { siteId: site.id },
          orderBy: { updatedAt: "desc" },
          take: limit,
          skip: offset,
        });

        return pages.map((page) => ({
          id: page.id,
          title: page.title,
          path: page.path,
          status: page.status,
          publishedAt: page.publishedAt?.toISOString() ?? null,
          updatedAt: page.updatedAt.toISOString(),
        }));
      },
    },
    Page: {
      metadata(parent) {
        return parent.metadata ?? {};
      },
      blocks(parent) {
        return parent.blocks ?? [];
      },
    },
  },
});

function ensureSiteAccess(auth: ApiTokenWithSite, siteId: string) {
  if (auth.siteId !== siteId) {
    throw new Error("API token cannot access the requested site.");
  }
}

function parseAst(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.NULL:
      return null;
    case Kind.OBJECT:
      return ast.fields.reduce<Record<string, unknown>>((acc, field) => {
        acc[field.name.value] = parseAst(field.value);
        return acc;
      }, {});
    case Kind.LIST:
      return ast.values.map((value) => parseAst(value));
    default:
      return null;
  }
}

