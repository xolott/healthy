import { describe, expect, it, vi } from "vitest";

import { runFirstOwnerCreatedChoreography } from "../../app/utils/firstOwnerCreatedChoreography";
import { healthyAuthMeQueryKey, healthyPublicStatusQueryKey } from "../../app/utils/healthyApiQueryKeys";

describe("runFirstOwnerCreatedChoreography", () => {
  it("clears shell, invokes logout when API resolves, invalidates caches for API base, marks probe, navigates to login — in order", async () => {
    const events: string[] = [];
    const baseUrl = "http://api.example";

    await runFirstOwnerCreatedChoreography({ ok: true, baseUrl }, async (url) => {
      events.push(`logout:${url}`);
    }, {
      clearAuthenticatedShellState: () => events.push("clear"),
      invalidatePublicStatusAndAuthMe: async (url) => {
        events.push(`invalidate:${url}`);
      },
      markProbe: () => events.push("probe"),
      navigateToLogin: async () => events.push("nav:/login"),
    });

    expect(events).toEqual([
      "clear",
      `logout:${baseUrl}`,
      `invalidate:${baseUrl}`,
      "probe",
      "nav:/login",
    ]);
  });

  it("passes query key roots expected by Pinia Colada invalidation (contract)", () => {
    const baseUrl = "http://api.example";
    expect([...healthyPublicStatusQueryKey(baseUrl)]).toEqual(["healthy-public-status", baseUrl]);
    expect([...healthyAuthMeQueryKey(baseUrl)]).toEqual(["healthy-auth-me", baseUrl]);
  });

  it("when logout fails, continues with invalidation when API resolution is ok — does not propagate logout failure", async () => {
    const events: string[] = [];

    await runFirstOwnerCreatedChoreography({ ok: true, baseUrl: "http://api.example" }, async () => {
      throw new Error("network");
    }, {
      clearAuthenticatedShellState: () => events.push("clear"),
      invalidatePublicStatusAndAuthMe: async (url) => events.push(`invalidate:${url}`),
      markProbe: () => events.push("probe"),
      navigateToLogin: async () => events.push("nav"),
    });

    expect(events).toEqual(["clear", "invalidate:http://api.example", "probe", "nav"]);
  });

  it("when API resolution is not ok, skips logout and invalidation but still clears, probes, and navigates", async () => {
    const events: string[] = [];
    const logout = vi.fn(async () => {});
    const invalidate = vi.fn(async () => {});

    await runFirstOwnerCreatedChoreography({ ok: false, reason: "missing" }, logout, {
      clearAuthenticatedShellState: () => events.push("clear"),
      invalidatePublicStatusAndAuthMe: invalidate,
      markProbe: () => events.push("probe"),
      navigateToLogin: async () => events.push("nav"),
    });

    expect(events).toEqual(["clear", "probe", "nav"]);
    expect(logout).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("when API resolution is invalid_url, skips logout and invalidation", async () => {
    const logout = vi.fn(async () => {});
    const invalidate = vi.fn(async () => {});

    await runFirstOwnerCreatedChoreography({ ok: false, reason: "invalid_url" }, logout, {
      clearAuthenticatedShellState: () => {},
      invalidatePublicStatusAndAuthMe: invalidate,
      markProbe: () => {},
      navigateToLogin: async () => {},
    });

    expect(logout).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
