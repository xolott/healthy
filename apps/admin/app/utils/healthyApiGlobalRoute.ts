/**
 * Pure routing rules for `healthy-api.global.ts`, so status-driven navigation
 * and session restoration outcomes stay testable without Nuxt runtime.
 */

export type HealthyGlobalRedirect =
  | { path: "/setup" }
  | { path: "/setup"; query: { reconnect: "1" } }
  | { path: "/onboarding" }
  | { path: "/login" }
  | { path: "/" };

export type HealthyGlobalNavigationResult =
  | { action: "continue" }
  | { action: "redirect"; target: HealthyGlobalRedirect };

export function isInternalHealthyAdminPath(path: string): boolean {
  return path.startsWith("/_nuxt") || path.startsWith("/__") || path.startsWith("/api/");
}

export function isSetupPath(path: string): boolean {
  return path === "/setup" || path.startsWith("/setup/");
}

export type PublicStatusResult = { ok: true; setupRequired: boolean } | { ok: false };

export type AuthMeResult = "authenticated" | "unauthorized" | "error";

/**
 * Mirrors `middleware/healthy-api.global.ts`: same branch order, same redirects.
 * When `apiBaseUrlTrimmed` is empty, `publicStatus` is ignored.
 * When `apiBaseUrlTrimmed` is non-empty, `publicStatus` must be the outcome of the `/status` fetch attempt.
 */
export function resolveHealthyApiGlobalNavigation(input: {
  path: string;
  apiBaseUrlTrimmed: string;
  publicStatus?: PublicStatusResult;
  /** Required whenever the middleware would have called `fetchAuthMe` before deciding. */
  authMe?: AuthMeResult;
}): HealthyGlobalNavigationResult {
  const { path, apiBaseUrlTrimmed } = input;

  if (isInternalHealthyAdminPath(path) || isSetupPath(path)) {
    return { action: "continue" };
  }

  if (!apiBaseUrlTrimmed) {
    return { action: "redirect", target: { path: "/setup" } };
  }

  const publicStatus = input.publicStatus;
  if (publicStatus === undefined) {
    throw new Error("resolveHealthyApiGlobalNavigation: publicStatus is required when API base URL is set");
  }

  if (!publicStatus.ok) {
    return { action: "redirect", target: { path: "/setup", query: { reconnect: "1" } } };
  }

  if (publicStatus.setupRequired) {
    if (path === "/onboarding") {
      return { action: "continue" };
    }
    return { action: "redirect", target: { path: "/onboarding" } };
  }

  if (path === "/onboarding") {
    return { action: "redirect", target: { path: "/login" } };
  }

  const authMe = input.authMe;
  if (authMe === undefined) {
    throw new Error("resolveHealthyApiGlobalNavigation: authMe is required for this path/status combination");
  }

  if (path === "/login") {
    if (authMe === "authenticated") {
      return { action: "redirect", target: { path: "/" } };
    }
    if (authMe === "error") {
      return { action: "redirect", target: { path: "/setup", query: { reconnect: "1" } } };
    }
    return { action: "continue" };
  }

  if (authMe === "unauthorized") {
    return { action: "redirect", target: { path: "/login" } };
  }
  if (authMe === "error") {
    return { action: "redirect", target: { path: "/setup", query: { reconnect: "1" } } };
  }
  return { action: "continue" };
}
