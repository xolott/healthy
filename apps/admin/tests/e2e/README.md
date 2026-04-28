End-to-end coverage for issue #23: admin auth and configuration flows against a real API and browser.

## Prerequisites

- Docker (for Testcontainers Postgres in `stack.mjs`)
- Chromium for Playwright: `pnpm exec playwright install chromium` from `apps/admin`

## Run

```bash
pnpm --filter admin test:e2e
```

This runs two Playwright projects: the full stack (Postgres + API + Nuxt on **127.0.0.1:3041**) and a Nuxt-only stack on **127.0.0.1:3020** with an unreachable API URL.

## Admin / mobile parity

Both surfaces send first-time owners through explicit sign-in after account creation (`/login` on admin; `HealthyAuthRoutes.login` on mobile). Mobile does not use browser HttpOnly cookies; session handling differs by platform while the post-setup navigation contract matches.
