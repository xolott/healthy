import { describe, expect, it } from "vitest";

import {
  isInternalHealthyAdminPath,
  isSetupPath,
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

describe("isSetupPath", () => {
  it("matches /setup and nested setup paths", () => {
    expect(isSetupPath("/setup")).toBe(true);
    expect(isSetupPath("/setup/extra")).toBe(true);
    expect(isSetupPath("/onboarding")).toBe(false);
  });
});

describe("resolveHealthyApiGlobalNavigation", () => {
  it("continues for internal and setup paths regardless of base URL", () => {
    expect(resolveHealthyApiGlobalNavigation({ path: "/_nuxt/entry.js", apiBaseUrlTrimmed: "" })).toEqual({
      action: "continue",
    });
    expect(resolveHealthyApiGlobalNavigation({ path: "/setup", apiBaseUrlTrimmed: "" })).toEqual({
      action: "continue",
    });
  });

  it("redirects to /setup when no API base URL is stored", () => {
    expect(resolveHealthyApiGlobalNavigation({ path: "/", apiBaseUrlTrimmed: "" })).toEqual({
      action: "redirect",
      target: { path: "/setup" },
    });
  });

  it("redirects with reconnect when /status cannot be fetched", () => {
    expect(
      resolveHealthyApiGlobalNavigation({
        path: "/",
        apiBaseUrlTrimmed: "http://127.0.0.1:9",
        publicStatus: { ok: false },
      }),
    ).toEqual({
      action: "redirect",
      target: { path: "/setup", query: { reconnect: "1" } },
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

  it("on /login: stays on login when unauthorized; reconnect on transport errors", () => {
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
      target: { path: "/setup", query: { reconnect: "1" } },
    });
  });

  it("on protected routes: login when unauthorized; reconnect on errors", () => {
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
      target: { path: "/setup", query: { reconnect: "1" } },
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
