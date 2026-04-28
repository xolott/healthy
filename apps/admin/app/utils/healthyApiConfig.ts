export type ConfiguredApiResolution =
  | { ok: true; baseUrl: string }
  | { ok: false; reason: "missing" | "invalid_url" };

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
