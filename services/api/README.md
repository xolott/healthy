# Healthy API (`services/api`)

Scaffold Fastify HTTP service exposing:

- `GET /health`
- Swagger UI at `/docs`

Persistence uses the shared package `@healthy/db` (Drizzle + PostgreSQL). Optional `DATABASE_URL` is validated at startup; omit it for health-only runs. See repository [`docs/database.md`](../../docs/database.md) for local Postgres, migrations, and tests.

## Local development

Requires Node.js **>= 24.15.0** and pnpm (see repo root tooling pins).

From repository root:

```bash
pnpm install
pnpm --filter api dev
```

The server listens using environment variables documented in `./.env.example` (including `DATABASE_URL` when you connect to a database).

## Scripts

See `services/api/package.json` for `lint`, `test`, `typecheck`, and `build` targets.

## Production build

```bash
pnpm --filter api build
pnpm --filter api start
```

The compiled JavaScript emits to `./dist/` via `tsconfig.build.json`.
