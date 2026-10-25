# Repository guidance

This is the canonical instruction file for this repository. Claude Code loads it through
`CLAUDE.md`.

## Start here

- Inspect branch, upstream divergence, status, and diff before editing.
- Preserve pre-existing changes and keep unrelated work out of the patch.
- Use the repository's existing runtime, package manager, framework, and deployment model.
- Do not refactor an existing project into the preferred new-project stack unless explicitly requested.
- Verify current documentation before changing version-dependent dependencies or hosting behavior.

## Project

DiaTrack tracks diabetes sensors, catheters, replacements, failures, and reminders.

It uses Bun, TanStack Start, React, oRPC, better-auth, Drizzle, PostgreSQL, Valibot, Tailwind CSS, Biome, Vitest, Docker, and Railway.

## Project rules

- Treat health and account data as sensitive.
- Keep server-only code, database access, authentication, and email delivery out of client components.
- Every protected oRPC procedure enforces authorization itself.
- Use generated Drizzle migrations and never edit generated route trees manually.
- Preserve reminder idempotency so retries do not send duplicate notifications.
- Better Auth 1.7.3+ identifies accounts by `(provider_id, account_id)`. Migration 0003 makes the historical issuer nullable and replaces its unique index without deleting existing account data. Keep migration 0002 intact. New signups and existing-account login must both pass the production release tests.
- Tailwind CSS v4 needs `h-(--cell-size)` for CSS variables. The v3 form `h-[--cell-size]` compiles to invalid CSS and is silently dropped.
- Keep Tailwind's source base in `src/styles/app.css` explicitly scoped to
  `src/`. Docker omits `.gitignore`; scanning the project root can include the
  first build's `dist/` output in the server pass and produce a stylesheet hash
  absent from `dist/client`. Release tests must fetch the SSR stylesheet URL,
  not merely check that login and device actions work without styling.
- Railway's edge sets the client address in `X-Real-IP`; better-auth reads it via `advanced.ipAddress.ipAddressHeaders` in `src/server/auth.ts`.

## Commands

- `bun run lint`: Biome validation
- `bun run test`: tests
- `bun run build`: production build
- `bun run test:release`: Chromium checks against the built production server.
  Requires `DIATRACK_RELEASE_TEST=1` and `DATABASE_URL` pointing to a disposable
  local database named `diatrack_release`. Run `RESET_DB=false bun migrate.mjs`
  and `bun run build` first; use `bunx playwright install chromium` once.
  The config starts the server with isolated auth settings and test registration.
  `RELEASE_BASE_URL=http://127.0.0.1:<port>` instead targets an already running
  local test container. Never point these write tests at production.
- `bun run db:generate`: generate migrations

## Verification

`main` requires an up-to-date pull request with `Lint, typecheck, test, build`
and `Production release smoke` passing from GitHub Actions, plus
`GitGuardian Security Checks`, including for administrators. No second-person
approval is required. Do not bypass or
temporarily disable protection to ship changes.

CI's `Production release smoke` job uses PostgreSQL 17 (production's major
version), migrates the actual Docker image twice, and tests mobile Chromium
login, device persistence/completion, protected routes and cross-account
read/delete denial. Fixtures use synthetic accounts and no SMTP configuration.
Failure traces/screenshots contain only isolated test data.
The CI browser runner uses the official Playwright `noble` image with its
version derived from the installed, pinned `@playwright/test` package so browser
binaries and the test runner stay compatible without separate OS provisioning.

Run the relevant checks and exercise the affected workflow, endpoint, or generated artifact.
State clearly when authenticated, database, deployment, or live verification was not possible.

## Maintaining instructions

Public screenshots belong in `docs/screenshots/` and must use an isolated demo
account with synthetic device history. Label the demo data in the README;
never publish personal health records or account details.

Update `AGENTS.md` when verified, durable repository behavior changes. Keep it concise and
move detailed explanations into `docs/`. Keep `CLAUDE.md` as the compatibility import
unless Claude-specific guidance is genuinely required.
