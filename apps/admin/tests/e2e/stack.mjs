/**
 * E2E stack: Postgres (Testcontainers) + API + Nuxt dev for Playwright `webServer`.
 * Run from `apps/admin` (Playwright default cwd).
 */
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";

import { PostgreSqlContainer } from "@testcontainers/postgresql";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..", "..", "..");
const adminRoot = path.join(repoRoot, "apps", "admin");
const apiRoot = path.join(repoRoot, "services", "api");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      s.close(() => {
        if (typeof addr === "object" && addr !== null) {
          resolve(addr.port);
        } else {
          reject(new Error("Could not resolve free port"));
        }
      });
    });
    s.on("error", reject);
  });
}

async function waitForFetch(url, { timeoutMs = 120_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = "unknown";
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.ok || res.status === 302 || res.status === 301) {
        return;
      }
      lastErr = `HTTP ${String(res.status)}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timeout waiting for ${url}: ${lastErr}`);
}

let container;
let apiProc;
let nuxtProc;

async function shutdown() {
  if (nuxtProc && !nuxtProc.killed) {
    nuxtProc.kill("SIGTERM");
  }
  if (apiProc && !apiProc.killed) {
    apiProc.kill("SIGTERM");
  }
  if (container) {
    try {
      await container.stop();
    } catch {
      /* ignore */
    }
  }
}

process.on("SIGINT", () => void shutdown().finally(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown().finally(() => process.exit(0)));

try {
  container = await new PostgreSqlContainer("postgres:16-alpine").start();
  const databaseUrl = container.getConnectionUri();

  execFileSync("pnpm", ["--filter", "@healthy/db", "db:migrate"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  const apiPort = await getFreePort();

  apiProc = spawn("pnpm", ["exec", "tsx", "./src/main.ts"], {
    cwd: apiRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PORT: String(apiPort),
      HOST: "127.0.0.1",
    },
  });

  apiProc.on("exit", (code, signal) => {
    if (code !== 0 && code !== null && signal !== "SIGTERM") {
      console.error(`API exited unexpectedly: code=${String(code)} signal=${String(signal)}`);
    }
  });

  await waitForFetch(`http://127.0.0.1:${String(apiPort)}/status`);

  const nuxtPort = process.env.E2E_NUXT_PORT ?? "3000";
  const apiBase = `http://127.0.0.1:${String(apiPort)}`;

  nuxtProc = spawn("pnpm", ["-C", adminRoot, "exec", "nuxt", "dev", "--host", "127.0.0.1", "--port", nuxtPort], {
    stdio: "inherit",
    env: {
      ...process.env,
      NUXT_PUBLIC_API_BASE_URL: apiBase,
      NUXT_DISABLE_TYPECHECK: "1",
    },
  });

  nuxtProc.on("exit", (code, signal) => {
    if (code !== 0 && code !== null && signal !== "SIGTERM") {
      console.error(`Nuxt exited unexpectedly: code=${String(code)} signal=${String(signal)}`);
    }
  });

  await waitForFetch(`http://127.0.0.1:${nuxtPort}/`);

  console.error(`E2E stack ready: API ${apiBase}, admin http://127.0.0.1:${nuxtPort}`);

  await new Promise(() => {
    /* block until signal */
  });
} catch (e) {
  console.error(e);
  await shutdown();
  process.exit(1);
}
