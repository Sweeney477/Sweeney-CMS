# Sweeney CMS Documentation

## Architecture

| Layer | Description |
| --- | --- |
| Frontend | Next.js 16 App Router (`apps/web`) powers both the public site (route group `(site)`) and the admin experience `(admin)`. |
| Backend | Server actions + REST API routes handle mutations, preview toggles, and health checks. NextAuth (credentials) guards admin routes. |
| Data | Prisma + PostgreSQL capture multi-site content (`Site`, `Page`, `Revision`, `ContentBlock`, `NavigationMenu`, `Metadata`, `Asset`). Migrations live in `apps/web/prisma/migrations`. |
| Infrastructure | Docker Compose spins up Postgres for local dev. Deployments target Vercel (ISR, draft mode, typed routes) but stay portable. |

## Environment & Secrets

Copy `env.example` → `.env` at the repo root. Important values:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Connection strings for Prisma + migrations. |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Required by NextAuth. Generate a 32+ char secret. |
| `NEXT_PUBLIC_APP_URL` | Base URL for previews + metadata. |
| `REVALIDATION_SECRET` | Shared secret for `/api/revalidate`. |
| `SEED_ADMIN_*` | Credentials used by `npm run db:seed`. |

## Local Development Workflow

1. `docker compose up -d postgres`
2. `npm install`
3. `npm run db:generate && npm run db:migrate -- --name init`
4. `npm run db:seed`
5. `npm run dev` and visit `http://localhost:3000`

Preview mode: `/api/preview?token=<site.previewSecret>&path=/some-page&site=<slug>` enables drafts. Exit preview via `/api/preview/disable` (Next built-in).

## Multi-site Management

- Sites live in the `Site` table and are scoped by slug/domain.
- Admin UI exposes a site switcher (query param `?site=<slug>`). All CRUD requests include `siteId`.
- Navigation and metadata are namespaced per site, so duplicating a site means seeding menus + settings for the new record.
- Preview secrets are per-site to keep shareable links isolated.

## Deployment Notes

- **Vercel**: Set all env vars in the project settings, enable preview deployments for each branch, and add ISR revalidation via `/api/revalidate`.
- **Other platforms**: Use the same Dockerized Postgres or managed providers (Neon, Supabase, RDS). The app is stateless—scale horizontally as long as `NEXTAUTH_SECRET` and DB remain consistent.
- **CI/CD**: Run `npm run lint` and `npm run build` per commit. Optionally add `npm run db:generate` to ensure migrations compile.

## Extending the CMS

- **Custom Blocks**: Add new block types in `prisma/schema.prisma` (`ContentBlock.kind`) and extend the renderer in `src/components/site/page-renderer.tsx`.
- **Media**: Implement an asset service + upload API; connect to S3/R2 and store metadata in `Asset`.
- **Roles & Permissions**: Expand the `Role` model permissions JSON or introduce a policy layer in `server/auth/guards`.
- **Headless API**: Expose GraphQL or REST endpoints in `src/app/api` to allow other projects to consume content.

## Troubleshooting

- Prisma errors about the datasource: ensure `DATABASE_URL` is reachable and run `npm run db:generate`.
- Stale content on the public site: call `/api/revalidate` with `REVALIDATION_SECRET` after publishing.
- Preview link returns 401: verify `site.previewSecret` matches the `token` you're passing and that the site slug/domain exists.

