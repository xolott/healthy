import { type HealthyPublicStatus, fetchHealthyPublicStatus } from "../utils/healthyApiStatus";
import { AuthMeUnauthorizedError, fetchAuthMe } from "../utils/healthyApiAuth";

export default defineNuxtRouteMiddleware(async (to) => {
  if (
    to.path.startsWith("/_nuxt") ||
    to.path.startsWith("/__") ||
    to.path.startsWith("/api/")
  ) {
    return;
  }

  if (to.path === "/setup" || to.path.startsWith("/setup/")) {
    return;
  }

  const apiCookie = useCookie("healthy_api_base_url", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  const baseUrl = (apiCookie.value ?? "").trim();

  if (!baseUrl) {
    return navigateTo("/setup");
  }

  let status: HealthyPublicStatus;
  try {
    status = await fetchHealthyPublicStatus(baseUrl);
  } catch {
    return navigateTo({ path: "/setup", query: { reconnect: "1" } });
  }

  if (status.setupRequired) {
    if (to.path === "/onboarding") {
      return;
    }
    return navigateTo("/onboarding");
  }

  if (to.path === "/onboarding") {
    return navigateTo("/login");
  }

  if (to.path === "/login") {
    try {
      await fetchAuthMe(baseUrl);
      return navigateTo("/");
    } catch (e) {
      if (!(e instanceof AuthMeUnauthorizedError)) {
        return navigateTo({ path: "/setup", query: { reconnect: "1" } });
      }
    }
    return;
  }

  let authed = false;
  try {
    await fetchAuthMe(baseUrl);
    authed = true;
  } catch (e) {
    if (e instanceof AuthMeUnauthorizedError) {
      authed = false;
    } else {
      return navigateTo({ path: "/setup", query: { reconnect: "1" } });
    }
  }

  if (!authed) {
    return navigateTo("/login");
  }

  return;
});
