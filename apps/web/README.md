## Sweeney CMS (web)

Next.js 16 application that powers the multi-site CMS experience (public site + admin). Key features:

- App Router with server components, draft mode previews, and typed routes.
- Prisma + PostgreSQL schema for multi-site content, navigation, revisions, and assets.
- NextAuth credentials auth + admin UI for pages, navigation, metadata, and settings.
- Draft/publish workflow with preview links and ISR revalidation endpoints.

## Requirements

- Node 20.x (matches the Next 16 requirement)
- npm 10 (workspace aware)
- Docker (optional) for local Postgres via `docker compose`

## Setup

1. Copy the example environment file and adjust secrets:

   ```bash
   cp ../env.example .env
   ```

2. Start Postgres (either locally or via Docker):

   ```bash
   docker compose up -d postgres
   ```

3. Install dependencies from the repo root to respect workspaces:

   ```bash
   npm install
   ```

4. Generate the Prisma client, run the initial migration, and seed demo content:

   ```bash
   npm run db:generate
   npm run db:migrate -- --name init
   npm run db:seed
   ```

5. Start the dev server:

   ```bash
   npm run dev
   ```

Log in at `/admin/sign-in` with the credentials defined in your `.env` (`SEED_ADMIN_EMAIL/PASSWORD`).

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Starts Next.js in dev mode with App Router |
| `npm run build` | Creates a production build |
| `npm run start` | Runs the production server |
| `npm run lint` | ESLint (Next rules + TypeScript) |
| `npm run db:generate` | Generates Prisma client |
| `npm run db:migrate` | Applies pending migrations locally |
| `npm run db:deploy` | Applies migrations in production |
| `npm run db:seed` | Seeds demo site, roles, nav, and sample content |

## Preview flow

- Generate preview URL: `/api/preview?token=<site.previewSecret>&path=/about&site=primary`
- Draft mode fetches the latest revision for a page and bypasses ISR caching.
- Call `/api/revalidate` with `REVALIDATION_SECRET` after publishing to invalidate ISR cache.

## Admin overview

- `/admin`: dashboard + quick stats
- `/admin/pages`: page listing and creation
- `/admin/pages/[pageId]`: rich content editor with blocks + publish controls
- `/admin/navigation`: manage primary nav items
- `/admin/settings`: site metadata, domain, and preview secret

This app is optimized for Vercel (ISR + previews) but stays hosting-agnostic via Dockerized databases, Prisma migrations, and documented env requirements. See `docs/README.md` for broader platform guidance.
