import { describe, expect, it, vi } from "vitest";

import {
  performHealthyApiLogoutBestEffort,
  runSessionEndedChoreography,
} from "../../app/utils/sessionEndedChoreography";
import { healthyAuthMeQueryKey, healthyPublicStatusQueryKey } from "../../app/utils/healthyApiQueryKeys";

describe("performHealthyApiLogoutBestEffort", () => {
  it("calls logout when API base resolves; ignores logout rejection so session-ended steps can proceed", async () => {
    const logout = vi.fn().mockRejectedValue(new Error("unreachable"));
    await performHealthyApiLogoutBestEffort({ ok: true, baseUrl: "http://api.example" }, logout);
    expect(logout).toHaveBeenCalledWith("http://api.example");
  });

  it("skips logout when API base is missing without throwing", async () => {
    const logout = vi.fn();
    await performHealthyApiLogoutBestEffort({ ok: false, reason: "missing" }, logout);
    expect(logout).not.toHaveBeenCalled();
  });

  it("skips logout when API base URL is invalid without throwing", async () => {
    const logout = vi.fn();
    await performHealthyApiLogoutBestEffort({ ok: false, reason: "invalid_url" }, logout);
    expect(logout).not.toHaveBeenCalled();
  });
});

describe("runSessionEndedChoreography", () => {
  it("clears shell, invalidates caches for API base, marks probe, navigates to login — in order", async () => {
    const events: string[] = [];
    const baseUrl = "http://api.example";

    await runSessionEndedChoreography({ ok: true, baseUrl }, {
      clearAuthenticatedShellState: () => events.push("clear"),
      invalidatePublicStatusAndAuthMe: async (url) => {
        events.push(`invalidate:${url}`);
      },
      markProbe: () => events.push("probe"),
      navigateAfterSessionEnded: async () => events.push("nav:/login"),
    });

    expect(events).toEqual(["clear", `invalidate:${baseUrl}`, "probe", "nav:/login"]);
  });

  it("passes query key roots expected by Pinia Colada invalidation (contract)", () => {
    const baseUrl = "http://api.example";
    expect([...healthyPublicStatusQueryKey(baseUrl)]).toEqual(["healthy-public-status", baseUrl]);
    expect([...healthyAuthMeQueryKey(baseUrl)]).toEqual(["healthy-auth-me", baseUrl]);
  });

  it("when API resolution is not ok, skips invalidation but still clears, probes, and navigates", async () => {
    const events: string[] = [];
    const invalidate = vi.fn(async () => {});

    await runSessionEndedChoreography({ ok: false, reason: "missing" }, {
      clearAuthenticatedShellState: () => events.push("clear"),
      invalidatePublicStatusAndAuthMe: invalidate,
      markProbe: () => events.push("probe"),
      navigateAfterSessionEnded: async () => events.push("nav"),
    });

    expect(events).toEqual(["clear", "probe", "nav"]);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("when API resolution is invalid_url, skips invalidation", async () => {
    const invalidate = vi.fn(async () => {});
    await runSessionEndedChoreography({ ok: false, reason: "invalid_url" }, {
      clearAuthenticatedShellState: () => {},
      invalidatePublicStatusAndAuthMe: invalidate,
      markProbe: () => {},
      navigateAfterSessionEnded: async () => {},
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
