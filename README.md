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

## Resume workflow with ChatGPT — no API key

JobFlow does not call an AI provider. It prepares a prompt locally, accepts the
response you paste back, and generates PDFs locally. No OpenAI API key or API
billing setup is required. Your normal ChatGPT plan limits still apply when you
use ChatGPT separately.

1. Run `pnpm --filter api db:migrate` to add the profile, analysis and resume tables.
2. Open **My Profile** and save your real skills, experience, projects, education,
   certifications and languages, with dates and concrete examples.
3. On an application card, choose **Prepare resume**, paste the full offer
   (50–20,000 characters), and choose **Save description**.
4. Choose **Prepare prompt**, then **Copy prompt**. Open ChatGPT and paste it into
   a chat. If clipboard access is unavailable, select and copy the prompt manually.
5. Copy ChatGPT's complete response into **ChatGPT response** and choose
   **Import resume**. The prompt requests a structured JSON response; plain JSON
   and a single JSON code block are accepted, up to 80,000 characters.
6. Review the imported analysis and resume, edit the draft, check the review
   checkbox and save. **Download PDF** exports the saved, reviewed version.

Only PDF export is included. There is no Word export or automatic import from
job URLs or existing CV files. No browser automation of ChatGPT is performed.
Separate contact fields stay out of the copied prompt and are included locally
in the PDF from the profile snapshot. Avoid putting unnecessary contact details
in the background text you copy.

Each response includes a source identifier tying it to its application, profile
and offer. If any of those sources changed, prepare a new prompt and obtain a new
response. A mismatched response returns 409 without saving anything. Malformed
responses, missing fields and quotes absent from the saved profile return 400.
Ask ChatGPT to correct its response using the original prompt, then paste it again.
Failed imports preserve the text you pasted and the existing resume versions.

An import saves the analysis and a new resume version in one transaction.
Existing versions keep their source snapshots when you edit your profile.
Review is required before PDF download. Resume edits use updatedAt to avoid
overwriting changes made in another tab. PDFs contain text and use automatic
pagination; no generated HTML is rendered.

Checking that a source quote exists does not establish that every interpretation
is accurate. Verify names, dates, skills and achievements before using a CV.
This remains a local single-user workspace without authentication.

### Career API

- GET /profile — current profile, or { content: null } when none is saved
- PUT /profile — replace all supported profile fields
- GET /applications/:id/resume-workspace — offer, latest analysis and resume history
- PUT /applications/:id/description — save { jobDescription }
- GET /applications/:id/resume-prompt — locally prepare { sourceId, prompt }
- POST /applications/:id/resumes/import — validate and import { response }
- PATCH /applications/:id/resumes/:resumeId — save { content, reviewed, updatedAt }
- GET /applications/:id/resumes/:resumeId/pdf — download a reviewed version

The former POST /applications/:id/analyze and POST /applications/:id/resumes
provider endpoints are removed. The OpenAI SDK is no longer a dependency.

### Additional verification

- `pnpm --filter api test:integration` runs the manual workflow against
  PostgreSQL without an AI service or mocks for the career workflow. It creates a
  unique jobflow_test_* schema, applies both migrations, and removes only that
  schema when finished. DATABASE_URL must point to a local development database
  with schema-creation privileges.
- `pnpm --filter api test --runInBand` covers prompt preparation, source binding,
  JSON/code-fence parsing, evidence, validation, version edits and PDF pagination.
- `pnpm --filter web test` includes the manual prompt/import/review/PDF flow with
  mocked HTTP responses, along with profile and board checks. Chromium is required.
