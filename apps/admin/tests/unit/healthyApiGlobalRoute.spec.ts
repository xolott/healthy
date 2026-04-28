import { describe, expect, it } from "vitest";

import {
  isConfigurationErrorPath,
  isInternalHealthyAdminPath,
  resolveHealthyApiGlobalNavigation,
} from "../../app/utils/healthyApiGlobalRoute";

describe("isInternalHealthyAdminPath", () => {
  it("treats Nuxt internals as internal", () => {
    expect(isInternalHealthyAdminPath("/_nuxt/foo")).toBe(true);
    expect(isInternalHealthyAdminPath("/__vite")).toBe(true);
    expect(isInternalHealthyAdminPath("/api/hello")).toBe(true);
  });

  it("does not treat app routes as internal", () => {
    expect(isInternalHealthyAdminPath("/login")).toBe(false);
    expect(isInternalHealthyAdminPath("/")).toBe(false);
  });
});

describe("isConfigurationErrorPath", () => {
  it("matches /configuration-error and nested paths", () => {
    expect(isConfigurationErrorPath("/configuration-error")).toBe(true);
    expect(isConfigurationErrorPath("/configuration-error/extra")).toBe(true);
    expect(isConfigurationErrorPath("/onboarding")).toBe(false);
  });
});

describe("resolveHealthyApiGlobalNavigation", () => {
  it("continues for internal and configuration-error paths regardless of base URL", () => {
    expect(resolveHealthyApiGlobalNavigation({ path: "/_nuxt/entry.js", apiBaseUrlTrimmed: "" })).toEqual({
      action: "continue",
    });
    expect(resolveHealthyApiGlobalNavigation({ path: "/configuration-error", apiBaseUrlTrimmed: "" })).toEqual({
      action: "continue",
    });
  });

  it("redirects to configuration-error when no API base URL is configured", () => {
    expect(resolveHealthyApiGlobalNavigation({ path: "/", apiBaseUrlTrimmed: "" })).toEqual({
      action: "redirect",
      target: { path: "/configuration-error", query: { reason: "missing" } },
    });
  });

  it("redirects with invalid_url when deployment URL is not usable", () => {
    expect(
      resolveHealthyApiGlobalNavigation({
        path: "/",
        apiBaseUrlTrimmed: "",
        emptyApiBaseReason: "invalid_url",
      }),
    ).toEqual({
      action: "redirect",
      target: { path: "/configuration-error", query: { reason: "invalid_url" } },
    });
  });

  it("redirects with unreachable when /status cannot be fetched", () => {
    expect(
      resolveHealthyApiGlobalNavigation({
        path: "/",
        apiBaseUrlTrimmed: "http://127.0.0.1:9",
        publicStatus: { ok: false },
      }),
    ).toEqual({
      action: "redirect",
      target: { path: "/configuration-error", query: { reason: "unreachable" } },
    });
  });

  it("sends non-onboarding traffic to onboarding when setup is required", () => {
    expect(
      resolveHealthyApiGlobalNavigation({
        path: "/",
        apiBaseUrlTrimmed: "http://api",
        publicStatus: { ok: true, setupRequired: true },
      }),
    ).toEqual({ action: "redirect", target: { path: "/onboarding" } });
    expect(
      resolveHealthyApiGlobalNavigation({
        path: "/login",
        apiBaseUrlTrimmed: "http://api",
        publicStatus: { ok: true, setupRequired: true },
      }),
    ).toEqual({ action: "redirect", target: { path: "/onboarding" } });
  });

  it("allows /onboarding when setup is required", () => {
    expect(
      resolveHealthyApiGlobalNavigation({
        path: "/onboarding",
        apiBaseUrlTrimmed: "http://api",
        publicStatus: { ok: true, setupRequired: true },
      }),
    ).toEqual({ action: "continue" });
  });

  it("sends /onboarding to login once setup is complete", () => {
    expect(
      resolveHealthyApiGlobalNavigation({
        path: "/onboarding",
        apiBaseUrlTrimmed: "http://api",
        publicStatus: { ok: true, setupRequired: false },
      }),
    ).toEqual({ action: "redirect", target: { path: "/login" } });
  });

  it("on /login: redirects home when session is already valid (restoration)", () => {
    expect(
      resolveHealthyApiGlobalNavigation({
        path: "/login",
        apiBaseUrlTrimmed: "http://api",
        publicStatus: { ok: true, setupRequired: false },
        authMe: "authenticated",
      }),
    ).toEqual({ action: "redirect", target: { path: "/" } });
  });

  it("on /login: stays on login when unauthorized; configuration-error on transport errors", () => {
    expect(
      resolveHealthyApiGlobalNavigation({
        path: "/login",
        apiBaseUrlTrimmed: "http://api",
        publicStatus: { ok: true, setupRequired: false },
        authMe: "unauthorized",
      }),
    ).toEqual({ action: "continue" });
    expect(
      resolveHealthyApiGlobalNavigation({
        path: "/login",
        apiBaseUrlTrimmed: "http://api",
        publicStatus: { ok: true, setupRequired: false },
        authMe: "error",
      }),
    ).toEqual({
      action: "redirect",
      target: { path: "/configuration-error", query: { reason: "unreachable" } },
    });
  });

  it("on protected routes: login when unauthorized; configuration-error on errors", () => {
    expect(
      resolveHealthyApiGlobalNavigation({
        path: "/",
        apiBaseUrlTrimmed: "http://api",
        publicStatus: { ok: true, setupRequired: false },
        authMe: "unauthorized",
      }),
    ).toEqual({ action: "redirect", target: { path: "/login" } });
    expect(
      resolveHealthyApiGlobalNavigation({
        path: "/",
        apiBaseUrlTrimmed: "http://api",
        publicStatus: { ok: true, setupRequired: false },
        authMe: "error",
      }),
    ).toEqual({
      action: "redirect",
      target: { path: "/configuration-error", query: { reason: "unreachable" } },
    });
    expect(
      resolveHealthyApiGlobalNavigation({
        path: "/",
        apiBaseUrlTrimmed: "http://api",
        publicStatus: { ok: true, setupRequired: false },
        authMe: "authenticated",
      }),
    ).toEqual({ action: "continue" });
  });

  it("throws if authMe is missing when required", () => {
    expect(() =>
      resolveHealthyApiGlobalNavigation({
        path: "/",
        apiBaseUrlTrimmed: "http://api",
        publicStatus: { ok: true, setupRequired: false },
      }),
    ).toThrow(/authMe/);
  });
});
