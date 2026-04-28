# Healthy Admin (Nuxt)

Scaffold Vue/Nuxt admin shell that will eventually supervise both Flutter mobile apps from a unified web interface.

Authentication, persistence hooks, dashboards, and API integrations are intentionally **absent**.

## Prerequisites

Follow repository root toolchain pins (`.node-version`, `package.json#packageManager`) and docs in [`docs/development.md`](/docs/development.md).

## Commands

```bash
# from repo root
pnpm install
pnpm --filter admin dev
pnpm --filter admin build
pnpm --filter admin lint
pnpm --filter admin typecheck
pnpm --filter admin test
pnpm --filter admin test:e2e
```

Production preview locally:

```bash
pnpm --filter admin preview
```

## Runtime configuration

`NUXT_PUBLIC_API_BASE_URL` controls the surfaced API preview string (`app/pages/index.vue`). See `./.env.example`.
