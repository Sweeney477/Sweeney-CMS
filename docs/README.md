# Sweeney CMS Documentation

## Architecture

| Layer | Description |
| --- | --- |
| Frontend | Next.js 16 App Router (`apps/web`) powers both the public site (route group `(site)`) and the admin experience `(admin)`. |
| Backend | Server actions + REST API routes handle mutations, preview toggles, uploads, and health checks. NextAuth (credentials) guards admin routes. |
| Data | Prisma + PostgreSQL capture multi-site content (`Site`, `Page`, `Revision`, `ContentBlock`, `NavigationMenu`, `Metadata`, `Asset`, `AssetFolder`, `AssetTag`, `AssetTransform`). Migrations live in `apps/web/prisma/migrations`. |
| Infrastructure | Docker Compose spins up Postgres plus an optional Nginx-backed `/uploads` volume. K8s manifests include PVCs for databases and media storage. Deployments target Vercel (ISR, draft mode, typed routes) but stay portable. |

## Environment & Secrets

Copy `env.example` → `.env` at the repo root. Important values:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Connection strings for Prisma + migrations. |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Required by NextAuth. Generate a 32+ char secret. |
| `NEXT_PUBLIC_APP_URL` | Base URL for previews + metadata. |
| `ASSET_STORAGE_ROOT` | Absolute path where uploaded binaries are stored (default `./uploads`). |
| `ASSET_BASE_URL`, `NEXT_PUBLIC_ASSET_BASE_URL` | Base origin used to generate CDN-friendly asset URLs. |
| `MAX_UPLOAD_MB` | Upload limit enforced by the media API (defaults to 25 MB). |
| `OPENAI_API_KEY` | Enables AI-assisted alt-text prompts for images. |
| `REVALIDATION_SECRET` | Shared secret for `/api/revalidate`. |
| `PUBLISH_CRON_SECRET` | Authenticates the scheduled publish runner endpoint. |
| `SEED_ADMIN_*` | Credentials used by `npm run db:seed`. |

## Local Development Workflow

1. `docker compose up -d postgres uploads`
2. Ensure an `uploads` directory exists (or override `ASSET_STORAGE_ROOT`).
3. `npm install`
4. `npm run db:generate && npm run db:migrate -- --name init`
5. `npm run db:seed`
6. `npm run dev` and visit `http://localhost:3000`

Preview mode: `/api/preview?token=<site.previewSecret>&path=/some-page&site=<slug>` enables drafts. Exit preview via `/api/preview/disable` (Next built-in).

## Preview & Scheduling

- **Per-revision preview links** live on each page detail screen. Generate expiring URLs (no more sharing `site.previewSecret`) and revoke them when review is done. Links enable draft mode and pin the requested revision via an HttpOnly cookie.
- **Timezone-aware scheduler**: Choose an IANA timezone in “Admin → Settings”. All scheduling inputs respect that zone, and the backend stores both UTC and the original timezone for auditing.
- **Publish runner**: Scheduled revisions auto-release when someone hits the page, and you can trigger a headless sweep via `POST /api/publish/run` with `Authorization: Bearer $PUBLISH_CRON_SECRET` (perfect for Vercel Cron).
- **Publishing log**: The admin sidebar now shows a timeline of publish/unpublish/schedule events, including actor, source (manual vs scheduler), and target timestamps. Use the new “Unpublish page” action to pull live content while retaining history.

## Collaboration & Review

- **Structured workflow**: Submit drafts for review, approve, or request changes—all with optional reviewer notes. Each action captures a `ReviewEvent` and adds a corresponding entry to the Activity feed.
- **Inline block comments**: Every block in the visual editor exposes a 💬 badge. Click to open the side panel, start a thread anchored to that block, reply, or resolve the discussion. Threads sync via `/api/revisions/:id/comments`.
- **Activity feeds**: Page editors and the site overview now include feeds that merge workflow events, comment activity, and publication logs. These are also exposed via `/api/pages/:id/activity` and `/api/sites/:id/activity` for integrations.
- **Audit-friendly metadata**: Activity events store the actor, revision, optional notes, and any scheduling metadata so you can recreate the decision trail when publishing.

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
- **Media**: Extend the provided asset service to back onto S3/R2, add new transform presets, or hook in additional AI providers for metadata.
- **Roles & Permissions**: Expand the `Role` model permissions JSON or introduce a policy layer in `server/auth/guards`.
- **Headless API**: Expose GraphQL or REST endpoints in `src/app/api` to allow other projects to consume content.

## Integrations & Headless

- **API tokens**: Visit `Admin → Integrations` to issue site-scoped tokens. Pick the scopes you need:
  - `content:read` (required) – published REST/GraphQL reads.
  - `content:drafts` – include unpublished revisions.
  - `search:manage` – trigger search re-indexing.
- **REST example**:

  ```bash
  curl \
    -H "Authorization: Bearer <token>" \
    "http://localhost:3000/api/content/primary/home?draft=true"
  ```

- **GraphQL**: Queries are served from `/api/graphql` using the same bearer token. Example body:

  ```graphql
  query Page($site: String!, $path: String!) {
    page(site: $site, path: $path) {
      id
      title
      blocks {
        id
        kind
      }
    }
  }
  ```

- **Webhooks**: Configure delivery URLs, secrets, and subscribed events in the Integrations screen. Each delivery is recorded and can be retried from the UI; signatures ship in `x-sweeney-signature`.
- **Search adapters**: Flip between Algolia or Meilisearch by setting the env vars (`SEARCH_PROVIDER`, `ALGOLIA_*`, `MEILISEARCH_*`) and filling in the admin form. Use the “Run full re-index” button or hit `POST /api/search/reindex` with a token that has `search:manage`.

## Troubleshooting

- Prisma errors about the datasource: ensure `DATABASE_URL` is reachable and run `npm run db:generate`.
- Stale content on the public site: call `/api/revalidate` with `REVALIDATION_SECRET` after publishing.
- Preview link returns 401: ensure the share link hasn't expired or been revoked and that the `site` query param points at an existing slug/domain.

