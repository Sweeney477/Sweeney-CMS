import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

const localDbUrl =
  "postgresql://postgres:postgres@localhost:5432/sweeney_cms?schema=public";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url().default(localDbUrl),
    DIRECT_URL: z.string().url().default(localDbUrl),
    NEXTAUTH_SECRET: z
      .string()
      .min(32)
      .default("development-secret-development-secret"),
    NEXTAUTH_URL: z.string().url().default("http://localhost:3000"),
    SEED_ADMIN_EMAIL: z.string().email().optional(),
    SEED_ADMIN_PASSWORD: z.string().min(8).optional(),
    REVALIDATION_SECRET: z.string().min(16).optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
});

