/**
 * Nuxt only with an unreachable or invalid API URL — for configuration-error Playwright runs.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..", "..", "..", "..");
const adminRoot = path.join(repoRoot, "apps", "admin");

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

let nuxtProc;

async function shutdown() {
  if (nuxtProc && !nuxtProc.killed) {
    nuxtProc.kill("SIGTERM");
  }
}

process.on("SIGINT", () => void shutdown().finally(() => process.exit(0)));
process.on("SIGTERM", () => void shutdown().finally(() => process.exit(0)));

const mode = process.env.E2E_BAD_API_MODE ?? "unreachable";
const badApiUrl =
  mode === "invalid"
    ? "ftp://127.0.0.1:1"
    : `http://127.0.0.1:${String(await getFreePort())}`; /* nothing listening */

const nuxtPort = process.env.E2E_NUXT_PORT ?? "3020";

try {
  nuxtProc = spawn("pnpm", ["-C", adminRoot, "exec", "nuxt", "dev", "--host", "127.0.0.1", "--port", nuxtPort], {
    stdio: "inherit",
    env: {
      ...process.env,
      NUXT_PUBLIC_API_BASE_URL: badApiUrl,
      NUXT_DISABLE_TYPECHECK: "1",
    },
  });

  await waitForFetch(`http://127.0.0.1:${nuxtPort}/`);

  console.error(`Nuxt-only stack ready on http://127.0.0.1:${nuxtPort} (bad API: ${badApiUrl})`);

  await new Promise(() => {
    /* block */
  });
} catch (e) {
  console.error(e);
  await shutdown();
  process.exit(1);
}
