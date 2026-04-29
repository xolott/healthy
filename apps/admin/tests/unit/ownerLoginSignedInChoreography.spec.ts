import { describe, expect, it, vi } from "vitest";

import { healthyAuthMeQueryKey, healthyPublicStatusQueryKey } from "../../app/utils/healthyApiQueryKeys";
import { runOwnerSignedInChoreography } from "../../app/utils/ownerLoginSignedInChoreography";

const user = {
  id: "u1",
  email: "a@b.com",
  displayName: "Owner",
  role: "owner" as const,
};

describe("runOwnerSignedInChoreography", () => {
  it("sets user, invalidates caches for API base, marks probe, navigates home — in order", async () => {
    const events: string[] = [];
    const baseUrl = "http://api.example";

    await runOwnerSignedInChoreography(user, { ok: true, baseUrl }, {
      setCurrentUser: (u) => {
        events.push(`user:${u.id}`);
        expect(u).toEqual(user);
      },
      invalidatePublicStatusAndAuthMe: async (url) => {
        events.push(`invalidate:${url}`);
      },
      markProbe: () => events.push("probe"),
      navigateToHome: async () => events.push("nav:/home"),
    });

    expect(events).toEqual(["user:u1", `invalidate:${baseUrl}`, "probe", "nav:/home"]);
  });

  it("passes query key roots expected by Pinia Colada invalidation (contract)", () => {
    const baseUrl = "http://api.example";
    expect([...healthyPublicStatusQueryKey(baseUrl)]).toEqual(["healthy-public-status", baseUrl]);
    expect([...healthyAuthMeQueryKey(baseUrl)]).toEqual(["healthy-auth-me", baseUrl]);
  });

  it("when API resolution is not ok, skips invalidation but still sets user, probe, and navigates", async () => {
    const events: string[] = [];
    const invalidate = vi.fn(async () => {});

    await runOwnerSignedInChoreography(user, { ok: false, reason: "missing" }, {
      setCurrentUser: () => events.push("user"),
      invalidatePublicStatusAndAuthMe: invalidate,
      markProbe: () => events.push("probe"),
      navigateToHome: async () => events.push("nav"),
    });

    expect(events).toEqual(["user", "probe", "nav"]);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("when API resolution is invalid_url, skips invalidation", async () => {
    const invalidate = vi.fn(async () => {});
    await runOwnerSignedInChoreography(user, { ok: false, reason: "invalid_url" }, {
      setCurrentUser: () => {},
      invalidatePublicStatusAndAuthMe: invalidate,
      markProbe: () => {},
      navigateToHome: async () => {},
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
