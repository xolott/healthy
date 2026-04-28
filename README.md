# Healthy monorepo

Open-source scaffolding for:

- **[healthy_meals](apps/healthy_meals)** — Flutter app (meal tracker)
- **[healthy_workouts](apps/healthy_workouts)** — Flutter app (workout tracker)
- **[admin](apps/admin)** — Nuxt / Vue admin panel for both apps
- **[api](services/api)** — Fastify backend

This repository intentionally contains **scaffolding only**: app shells, health checks, tooling, Docker, docs, and CI. **Authentication, persistence, domain features, and data layers are out of scope** and will arrive in later plans.

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 24.15.0 (LTS recommended) |
| pnpm | 10.x (aligned with [`package.json`](./package.json) `packageManager`) |
| Flutter | 3.41.5 |

See [.node-version](./.node-version), [.tool-versions](./.tool-versions), and [`docs/development.md`](docs/development.md).

Database schema and migrations are documented in [`docs/database.md`](docs/database.md).

## Setup

### Node workspaces

```bash
corepack enable
pnpm install
```

### Flutter apps

Install Flutter SDK (see Flutter docs). From repo root:

```bash
dart pub global activate melos 7.5.1
melos bootstrap
```

Then per app:

```bash
cd apps/healthy_meals && flutter pub get
cd ../healthy_workouts && flutter pub get
```

## Scripts

Run from repo root (where `pnpm` is used):

| Script | Purpose |
|--------|---------|
| `pnpm doctor` | Check Node/pnpm/flutter presence |
| `pnpm dev` | Turbo pipelines for `admin` / `api` dev servers |
| `pnpm build` | Build wired packages |
| `pnpm lint` | Lint JS/TS packages |
| `pnpm format` | Format JS/TS |
| `pnpm test` | Test JS/TS packages (includes `@healthy/db`, `api`, `admin`; DB integration tests need Docker — see [`docs/database.md`](docs/database.md)) |
| `pnpm clean` | Clean turbo + typical artifacts |

Flutter: `flutter analyze` / `flutter test` under each app, or orchestrate via `melos` (see CI).

See each app’s README for specifics.

## Self-hosting

See [`docs/self-hosting.md`](docs/self-hosting.md).

## License

MIT — see [`LICENSE`](./LICENSE).
