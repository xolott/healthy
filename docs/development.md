# Local development

## Node / pnpm (admin + API)

1. Install [Node.js](https://nodejs.org/) matching `.node-version` (24.15.x LTS recommended).
2. Enable Corepack so pnpm aligns with root `packageManager`:

```bash
corepack enable
```

3. From repository root:

```bash
pnpm install
```

### Admin (Nuxt)

```bash
pnpm --filter admin dev
```

### API (Fastify)

```bash
pnpm --filter api dev
```

### PostgreSQL and Drizzle (`@healthy/db`)

For `DATABASE_URL`, local Postgres setup, generating and applying Drizzle migrations, schema boundaries, and how database tests fit into `pnpm test`, see [`docs/database.md`](./database.md).

## Flutter apps

Install Flutter SDK per [Flutter install](https://docs.flutter.dev/install). Prefer the version pinned in `.tool-versions` (`3.41.5`).

```bash
cd apps/healthy_meals && flutter pub get && flutter analyze
```

Repeat for `apps/healthy_workouts`.

Optionally activate Melos globally and run Melos-managed commands from repo root:

```bash
dart pub global activate melos 7.5.1
melos bootstrap
```

## Code quality

- **Dart**: `flutter analyze`, `flutter test` in each app directory.
- **TypeScript**: `pnpm lint`, `pnpm test` at repo root (Turbo pipelines).
