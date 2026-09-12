# JobFlow

A pnpm/Turbo monorepo with a NestJS API (`apps/api`) and Next.js board (`apps/web`).

## Local setup

Use Node 22.21+ and the package manager pinned in package.json.

1. Run `pnpm install` from the repository root.
2. Copy `apps/api/.env.example` to `apps/api/.env`.
3. Start PostgreSQL: `docker compose up -d postgres`.
4. Run `pnpm --filter api db:generate` and `pnpm --filter api db:migrate`.
5. Run `pnpm dev`. Open http://localhost:3000; the API listens on port 3001.

The board proxies /api/* to the NestJS API. To change the upstream, copy
`apps/web/.env.example` to `apps/web/.env.local`, set API_URL, and rebuild/restart
Next.js. Set PORT in the API environment if needed.

## First slice

Create applications with a company and position, optionally a location and HTTP(S)
job URL. Every existing schema stage appears on the board. Use each card's stage
selector to move it; changes persist in PostgreSQL and survive a refresh.

This is a **local single-user workspace without authentication**. The API lazily
creates demo@jobflow.local and scopes operations to that user. User IDs are not
accepted from clients. Authentication and multiple workspaces are future work.

The existing schema and initial migration are preserved. Companies are created
with applications; changing companyName associates a new company so another
application's company is never renamed. Deleting an application retains related
companies and the user.

## API

- GET /applications — list, newest first
- GET /applications/:id — read one
- POST /applications — create
- PATCH /applications/:id — edit any supported fields or status
- DELETE /applications/:id — delete (204)

Create requires companyName and position. Supported optional fields are location,
jobUrl and status (defaults to WISHLIST). PATCH requires at least one supported
field; location and jobUrl can be cleared with null or an empty string.
Unknown fields, invalid statuses, invalid URLs and malformed UUIDs return 400.
Missing applications return 404. Responses include the related company.

## Verification

- `pnpm --filter api test --runInBand`
- `pnpm --filter api test:e2e --runInBand`
- `pnpm --filter api exec eslint src test`
- `pnpm --filter web lint`
- `pnpm build`

The HTTP tests run NestJS with a mocked Prisma provider to verify validation,
routing, relation writes, all eight stage updates and error responses without a
database. For a live smoke test, start PostgreSQL and the apps, create an
application, move it, refresh the board, and delete it through the API.

Browser regression tests cover creation, all stage moves, reloading, failed
mutations, and retrying a failed list request using a mocked HTTP API. Run:

1. `pnpm --filter web exec playwright install chromium` (one-time browser download)
2. `pnpm --filter web build`
3. `pnpm --filter web test`

The test runner starts a production web server on port 3100. PostgreSQL is not
required for these browser tests. These mocked checks do not replace a live
PostgreSQL smoke test.