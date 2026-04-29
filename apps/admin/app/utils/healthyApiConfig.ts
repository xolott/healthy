export type ConfiguredApiResolution =
  | { ok: true; baseUrl: string }
  | { ok: false; reason: "missing" | "invalid_url" };

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * When the API URL uses `localhost` or `127.0.0.1` and the admin UI is opened on the other loopback
 * host, rewrite the API origin to match the page hostname so the browser sends `SameSite=Lax`
 * session cookies (they are host-specific).
 */
export function alignApiBaseUrlWithAdminHostname(apiBaseUrl: string, adminHostname: string | undefined): string {
  if (!adminHostname || !LOOPBACK_HOSTS.has(adminHostname)) {
    return apiBaseUrl;
  }
  try {
    const u = new URL(apiBaseUrl);
    if (!LOOPBACK_HOSTS.has(u.hostname) || u.hostname === adminHostname) {
      return apiBaseUrl.replace(/\/+$/, "");
    }
    u.hostname = adminHostname;
    return u.href.replace(/\/+$/, "");
  } catch {
    return apiBaseUrl;
  }
}

/**
 * Resolves the configured Healthy API base URL from runtime / env (`NUXT_PUBLIC_API_BASE_URL`).
 * Returns a normalized base without trailing slashes when valid.
 */
export function resolveConfiguredApiBaseUrl(raw: string | undefined): ConfiguredApiResolution {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { ok: false, reason: "missing" };
  }
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, reason: "invalid_url" };
    }
    return { ok: true, baseUrl: trimmed.replace(/\/+$/, "") };
  } catch {
    return { ok: false, reason: "invalid_url" };
  }
}

/**
 * Like {@link resolveConfiguredApiBaseUrl}, then aligns loopback API hostname with the admin page host
 * (see {@link alignApiBaseUrlWithAdminHostname}). Pass `useRequestURL().hostname` from Nuxt (server or client).
 */
export function resolveConfiguredApiBaseUrlForAdminRequest(
  raw: string | undefined,
  adminHostname: string | undefined,
): ConfiguredApiResolution {
  const resolved = resolveConfiguredApiBaseUrl(raw);
  if (!resolved.ok) {
    return resolved;
  }
  return { ok: true, baseUrl: alignApiBaseUrlWithAdminHostname(resolved.baseUrl, adminHostname) };
}
