import path from "node:path";

import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const localDbUrl =
  "postgresql://postgres:postgres@localhost:5432/sweeney_cms?schema=public";
const localUploadRoot =
  process.env.ASSET_STORAGE_ROOT ?? path.join(process.cwd(), "uploads");
const localAssetBase =
  process.env.ASSET_BASE_URL ?? "http://localhost:3000/uploads";
const localTokenSalt =
  process.env.HEADLESS_API_TOKEN_SALT ?? "dev-headless-token-salt";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url().default(localDbUrl),
    DIRECT_URL: z.string().url().default(localDbUrl),
    ASSET_STORAGE_ROOT: z.string().default(localUploadRoot),
    ASSET_BASE_URL: z.string().url().default(localAssetBase),
    MAX_UPLOAD_MB: z.coerce.number().min(1).max(512).default(25),
    OPENAI_API_KEY: z.string().min(10).optional(),
    NEXTAUTH_SECRET: z
      .string()
      .min(32)
      .default("development-secret-development-secret"),
    NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
    SEED_ADMIN_EMAIL: z.string().email().optional(),
    SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
    REVALIDATION_SECRET: z.string().min(16).optional(),
    PUBLISH_CRON_SECRET: z.string().min(16).optional(),
    HEADLESS_API_TOKEN_SALT: z.string().min(16).default(localTokenSalt),
    SEARCH_PROVIDER: z
      .enum(["NONE", "ALGOLIA", "MEILISEARCH"])
      .default("NONE"),
    ALGOLIA_APP_ID: z.string().min(5).optional(),
    ALGOLIA_API_KEY: z.string().min(16).optional(),
    ALGOLIA_INDEX: z.string().min(1).optional(),
    MEILISEARCH_HOST: z.string().url().optional(),
    MEILISEARCH_API_KEY: z.string().min(8).optional(),
    MEILISEARCH_INDEX: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_ASSET_BASE_URL: z
      .string()
      .url()
      .default(localAssetBase),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_ASSET_BASE_URL: process.env.NEXT_PUBLIC_ASSET_BASE_URL,
  },
});

