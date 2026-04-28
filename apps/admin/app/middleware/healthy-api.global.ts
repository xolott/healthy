import { type HealthyPublicStatus, fetchHealthyPublicStatus } from "../utils/healthyApiStatus";

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

  const session = useCookie("healthy_admin_session", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
  });
  const authed = session.value === "1";

  if (to.path === "/login") {
    return;
  }

  if (!authed) {
    return navigateTo("/login");
  }

  return;
});
