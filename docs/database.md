# Database and migrations (`@healthy/db`)

Shared PostgreSQL schema and Drizzle ORM live in the workspace package `**packages/db**` (npm name `@healthy/db`). The API and other services consume it via `workspace:*`; migrations are authored once in that package.

## Configure `DATABASE_URL` locally

Use a standard PostgreSQL connection string. The API and Drizzle Kit both expect the variable name `**DATABASE_URL**`.

To run PostgreSQL locally via Docker Compose from the repository root:

```bash
docker compose up
```

Use this URL when connecting from your machine:

```bash
postgres://healthy:healthy@127.0.0.1:5432/healthy_dev
```

Run the API and admin with pnpm on the host (see [`development.md`](./development.md)); point `DATABASE_URL` at the URL above.

If you run Postgres yourself instead of Compose:

1. Run PostgreSQL 16+ locally (Docker, Homebrew `postgresql@16`, managed cloud, and so on).
2. Create a database for development, for example `healthy_dev`:
  ```bash
   createdb healthy_dev
  ```
3. Export a URL (adjust user, password, host, and port to match your install):
  ```bash
   export DATABASE_URL="postgresql://localhost:5432/healthy_dev"
  ```
   With password authentication:
4. For the API, you can copy `services/api/.env.example` to `.env` and set `DATABASE_URL` there instead of exporting it in the shell.

**URL rules (API):** the scheme must be `postgres://` or `postgresql://`. See `services/api/src/config/validate-database-url.ts` and `services/api/.env.example`.

**Drizzle Kit:** `packages/db/drizzle.config.ts` reads `DATABASE_URL`. If it is unset, Kit falls back to `postgresql://127.0.0.1:5432/healthy_placeholder` so `generate` can still introspect the schema file; use a real URL for `migrate` / `studio` against your database.

## Package layout and naming


| Path                              | Role                                                                      |
| --------------------------------- | ------------------------------------------------------------------------- |
| `packages/db/src/schema/index.ts` | Single schema entrypoint imported by `drizzle.config.ts` and the migrator |
| `packages/db/drizzle/`            | Generated SQL migrations and `meta/` snapshots (Drizzle Kit output)       |
| `packages/db/drizzle.config.ts`   | Kit config: dialect `postgresql`, `schema`, `out`                         |
| `packages/db/src/*.ts`            | Repositories and client helpers (built to `dist/` for consumers)          |


New migration files are named by Drizzle Kit (for example `0002_far_cammi.sql`). Do not hand-rename Kit output; adjust the schema and regenerate if needed.

## Generate, review, and apply migrations

Always run Kit **from the db package** (or with a filter) so paths and `drizzle.config.ts` resolve correctly.

```bash
# From repository root
pnpm install
export DATABASE_URL="postgresql://localhost:5432/healthy_dev"   # real DB for migrate/studio

# 1) Edit schema in packages/db/src/schema/index.ts (and related modules if any)

# 2) Generate SQL from the schema diff
pnpm --filter @healthy/db db:generate

# 3) Review new files under packages/db/drizzle/ and packages/db/drizzle/meta/

# 4) Apply migrations to the database pointed at by DATABASE_URL
pnpm --filter @healthy/db db:migrate
```

The API workspace exposes convenience commands for local operations:

```bash
pnpm --filter api db:migrate
pnpm --filter api db:recreate
```

`db:recreate` clears local migration metadata, drops and recreates the local `public` schema, then applies all migrations again. It refuses `NODE_ENV=production` and non-local database hosts by default; set `ALLOW_NON_LOCAL_DB_RECREATE=1` only when you intentionally need to override that guard.

Optional: open Drizzle Studio against the same URL:

```bash
pnpm --filter @healthy/db db:studio
```

Integration tests apply the same migration folder programmatically (`drizzle-orm/postgres-js/migrator` in `packages/db/test/helpers/integration-db.ts`).

## Initial schema boundaries

The first migrations establish **identity and platform audit** only:

- `**users`** — accounts with roles (`owner`, `admin`, `member`), lifecycle status, soft delete, unique normalized email
- `**sessions**` — revocable sessions keyed by token hash (never store raw tokens)
- `**audit_logs**` — append-only audit trail with optional actor, entity references, and JSON metadata

## Explicitly deferred (not in this schema yet)

The following product areas are **out of scope** for the current `@healthy/db` tables; they will get their own migrations when designed:

- **Membership / tenancy** (for example organization membership, invites, roles beyond instance user role)
- **Meals** domain persistence (Flutter app `healthy_meals` is separate from server tables for now)
- **Workouts** domain persistence (Flutter app `healthy_workouts`)
- **User or app settings** tables (preferences, feature flags stored in Postgres, and so on)

Keep new tables cohesive with the above boundaries: extend `packages/db/src/schema/index.ts` and export through the same schema map used by Drizzle Kit.

## Tests and CI prerequisites

Root `**pnpm test`** runs Turbo `**test**` in every workspace that defines it, including `**@healthy/db**`, `**api**`, and `**admin**`.

`**@healthy/db` tests:**

- Unit-style tests under `packages/db/test/*.test.ts` (no database).
- Integration tests (`*.integration.test.ts`) start **PostgreSQL in Docker** via `@testcontainers/postgresql` (`postgres:16-alpine`).

**Prerequisites for `@healthy/db` integration tests:** a working **Docker** (or compatible) engine so Testcontainers can pull and run the image. If Docker is unavailable, those tests fail at container start; unit tests can still pass when run in isolation:

```bash
pnpm --filter @healthy/db exec vitest run test/normalize-email.test.ts
```

For full package coverage including integration tests:

```bash
pnpm --filter @healthy/db test
```

## Verification checklist (local)

After schema or migration workflow changes, run from the repository root:

```bash
pnpm install
pnpm --filter @healthy/db test
pnpm --filter api test
pnpm test
```

The last command is the same pipeline contributors use for JS/TS: database package, API (including `DATABASE_URL` validation and scaffold tests), admin, and any other packages with a `test` script.