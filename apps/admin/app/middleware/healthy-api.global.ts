import { AuthMeUnauthorizedError, fetchAuthMe } from "../utils/healthyApiAuth";
import { resolveConfiguredApiBaseUrl } from "../utils/healthyApiConfig";
import {
  isConfigurationErrorPath,
  isInternalHealthyAdminPath,
  resolveHealthyApiGlobalNavigation,
  type HealthyGlobalRedirect,
} from "../utils/healthyApiGlobalRoute";
import { fetchHealthyPublicStatus } from "../utils/healthyApiStatus";

function toNavigateArg(target: HealthyGlobalRedirect) {
  if ("query" in target) {
    return { path: target.path, query: target.query };
  }
  return target.path;
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (isInternalHealthyAdminPath(to.path) || isConfigurationErrorPath(to.path)) {
    return;
  }

  const config = useRuntimeConfig();
  const resolved = resolveConfiguredApiBaseUrl(String(config.public.apiBaseUrl ?? ""));

  if (!resolved.ok) {
    const emptyReason = resolved.reason === "missing" ? "missing" : "invalid_url";
    const missingNav = resolveHealthyApiGlobalNavigation({
      path: to.path,
      apiBaseUrlTrimmed: "",
      emptyApiBaseReason: emptyReason,
    });
    if (missingNav.action === "redirect") {
      return navigateTo(toNavigateArg(missingNav.target));
    }
    return;
  }

  const baseUrl = resolved.baseUrl;

  let publicStatus: { ok: true; setupRequired: boolean } | { ok: false };
  try {
    const status = await fetchHealthyPublicStatus(baseUrl);
    publicStatus = { ok: true, setupRequired: status.setupRequired };
  } catch {
    publicStatus = { ok: false };
  }

  if (!publicStatus.ok) {
    const d = resolveHealthyApiGlobalNavigation({
      path: to.path,
      apiBaseUrlTrimmed: baseUrl,
      publicStatus,
    });
    if (d.action === "redirect") {
      return navigateTo(toNavigateArg(d.target));
    }
    return;
  }

  if (publicStatus.setupRequired) {
    const d = resolveHealthyApiGlobalNavigation({
      path: to.path,
      apiBaseUrlTrimmed: baseUrl,
      publicStatus,
    });
    if (d.action === "redirect") {
      return navigateTo(toNavigateArg(d.target));
    }
    return;
  }

  if (to.path === "/onboarding") {
    return navigateTo("/login");
  }

  let authMe: "authenticated" | "unauthorized" | "error";
  try {
    await fetchAuthMe(baseUrl);
    authMe = "authenticated";
  } catch (e) {
    authMe = e instanceof AuthMeUnauthorizedError ? "unauthorized" : "error";
  }

  const d = resolveHealthyApiGlobalNavigation({
    path: to.path,
    apiBaseUrlTrimmed: baseUrl,
    publicStatus,
    authMe,
  });
  if (d.action === "redirect") {
    return navigateTo(toNavigateArg(d.target));
  }
});
