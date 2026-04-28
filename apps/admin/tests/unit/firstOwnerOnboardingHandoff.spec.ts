import { afterEach, describe, expect, it, vi } from "vitest";

import { postAuthLogout, postFirstOwnerSetup } from "../../app/utils/healthyApiAuth";

describe("first owner onboarding API handoff", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("runs first-owner setup then logout in the order used for login handoff", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/setup/first-owner")) {
          calls.push("setup");
          return {
            status: 201,
            ok: true,
            json: async () => ({
              user: {
                id: "1",
                email: "a@b.com",
                displayName: "A",
                role: "owner",
              },
              session: { token: "t", expiresAt: "2099-01-01T00:00:00.000Z" },
            }),
          };
        }
        if (String(url).includes("/auth/logout")) {
          calls.push("logout");
          return { status: 204, ok: true };
        }
        throw new Error(`unexpected ${url}`);
      }) as unknown as typeof fetch,
    );
    await postFirstOwnerSetup("http://api.example", {
      displayName: "A",
      email: "a@b.com",
      password: "x".repeat(12),
    });
    await postAuthLogout("http://api.example");
    expect(calls).toEqual(["setup", "logout"]);
  });
});
