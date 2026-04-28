import { afterEach, describe, expect, it, vi } from "vitest";

import {
  OwnerLoginInvalidCredentialsError,
  PASSWORD_MIN_LENGTH,
  postOwnerLogin,
} from "../../app/utils/healthyApiAuth";

describe("healthyApiAuth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes 12-char password minimum aligned with API policy", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
  });

  it("postOwnerLogin throws OwnerLoginInvalidCredentialsError on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 401,
        ok: false,
        json: async () => ({ error: "invalid_credentials" }),
      })) as unknown as typeof fetch,
    );
    await expect(
      postOwnerLogin("https://api.example", { email: "a@b.com", password: "x".repeat(12) }),
    ).rejects.toBeInstanceOf(OwnerLoginInvalidCredentialsError);
  });

  it("postOwnerLogin returns user and session on 200", async () => {
    const user = { id: "u1", email: "a@b.com", displayName: "A", role: "owner" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 200,
        ok: true,
        json: async () => ({
          user,
          session: { token: "opaque-token", expiresAt: "2099-01-01T00:00:00.000Z" },
        }),
      })) as unknown as typeof fetch,
    );
    const out = await postOwnerLogin("https://api.example/", {
      email: "a@b.com",
      password: "x".repeat(12),
    });
    expect(out.user).toEqual(user);
    expect(out.session.token).toBe("opaque-token");
    expect(out.session.expiresAt).toContain("2099");
  });
});
