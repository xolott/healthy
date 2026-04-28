End-to-end suites will land after core navigation and API stabilization.

Expected workflow:

```bash
pnpm --filter admin dev -- --host 127.0.0.1 --port 3000
pnpm --filter admin test:e2e
```
