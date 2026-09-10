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
- better-auth 1.7+ keys accounts on `(issuer, account_id)`; credential accounts use issuer `local:credential`. A generated migration that adds a NOT NULL column to a populated table must be edited to add it nullable, backfill, then enforce NOT NULL (see `drizzle/0002_add_account_issuer.sql`).
- Tailwind CSS v4 needs `h-(--cell-size)` for CSS variables. The v3 form `h-[--cell-size]` compiles to invalid CSS and is silently dropped.
- Railway's edge sets the client address in `X-Real-IP`; better-auth reads it via `advanced.ipAddress.ipAddressHeaders` in `src/server/auth.ts`.

## Commands

- `bun run lint`: Biome validation
- `bun run test`: tests
- `bun run build`: production build
- `bun run db:generate`: generate migrations

## Verification

Run the relevant checks and exercise the affected workflow, endpoint, or generated artifact.
State clearly when authenticated, database, deployment, or live verification was not possible.

## Maintaining instructions

Update `AGENTS.md` when verified, durable repository behavior changes. Keep it concise and
move detailed explanations into `docs/`. Keep `CLAUDE.md` as the compatibility import
unless Claude-specific guidance is genuinely required.
