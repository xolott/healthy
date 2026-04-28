# Healthy API (`services/api`)

Scaffold Fastify HTTP service exposing:

- `GET /health`
- Swagger UI at `/docs`

No persistence layer, migrations, repositories, authentication, or product routes yet.

## Local development

Requires Node.js **>= 24.15.0** and pnpm (see repo root tooling pins).

From repository root:

```bash
pnpm install
pnpm --filter api dev
```

The server listens using environment variables documented in `./.env.example`.

## Scripts

See `services/api/package.json` for `lint`, `test`, `typecheck`, and `build` targets.

## Production build

```bash
pnpm --filter api build
pnpm --filter api start
```

The compiled JavaScript emits to `./dist/` via `tsconfig.build.json`.
