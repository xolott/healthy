# Healthy API (`services/api`)

Scaffold Fastify HTTP service exposing:

- `GET /health`
- Swagger UI at `/docs`

Persistence uses the shared package `@healthy/db` (Drizzle + PostgreSQL). Optional `DATABASE_URL` is validated at startup; omit it for health-only runs. See repository `[docs/database.md](../../docs/database.md)` for local Postgres, migrations, and tests.

## Local development

Requires Node.js **>= 24.15.0** and pnpm (see repo root tooling pins).

From repository root:

```bash
pnpm install
pnpm --filter api dev
```

The server listens using environment variables documented in `./.env.example` (including `DATABASE_URL` when you connect to a database). You can run PostgreSQL with Compose (see repository root `docker-compose.yml`) and point `DATABASE_URL` at `postgres://healthy:healthy@127.0.0.1:5432/healthy_dev`.

## Scripts

See `services/api/package.json` for `lint`, `test`, `typecheck`, and `build` targets.

Database helpers:

```bash
pnpm --filter api db:migrate
pnpm --filter api db:recreate
```

`db:migrate` applies all pending Drizzle migrations. `db:recreate` clears local migration metadata, drops and recreates the local `public` schema, then applies migrations again; it refuses production and non-local database hosts unless `ALLOW_NON_LOCAL_DB_RECREATE=1` is set.

## Production build

```bash
pnpm --filter api build
pnpm --filter api start
```

The compiled JavaScript emits to `./dist/` via `tsconfig.build.json`.