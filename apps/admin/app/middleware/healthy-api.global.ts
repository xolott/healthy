import { AuthMeUnauthorizedError, fetchAuthMe } from "../utils/healthyApiAuth";
import {
  isInternalHealthyAdminPath,
  isSetupPath,
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
  if (isInternalHealthyAdminPath(to.path) || isSetupPath(to.path)) {
    return;
  }

  const apiCookie = useCookie("healthy_api_base_url", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  const baseUrl = (apiCookie.value ?? "").trim();

  const missingBase = resolveHealthyApiGlobalNavigation({
    path: to.path,
    apiBaseUrlTrimmed: baseUrl,
  });
  if (missingBase.action === "redirect") {
    return navigateTo(toNavigateArg(missingBase.target));
  }

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
