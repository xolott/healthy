import { afterEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useHealthyApiStore } from "../../app/stores/healthyApi";
import { AuthMeUnauthorizedError, fetchAuthMe, postAuthLogout, postOwnerLogin } from "../../app/utils/healthyApiAuth";

describe("owner login and logout flow (session + client state)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setActivePinia(undefined);
  });

  it("postOwnerLogin followed by fetchAuthMe reflects a restored cookie session", async () => {
    const user = { id: "u1", email: "a@b.com", displayName: "Owner", role: "owner" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/auth/login")) {
          return {
            status: 200,
            ok: true,
            json: async () => ({
              user,
              session: { token: "secret", expiresAt: "2099-01-01T00:00:00.000Z" },
            }),
          };
        }
        if (String(url).includes("/auth/me")) {
          return { status: 200, ok: true, json: async () => ({ user }) };
        }
        throw new Error(`unexpected ${url}`);
      }) as unknown as typeof fetch,
    );
    await postOwnerLogin("http://api.example", { email: "a@b.com", password: "x".repeat(12) });
    const me = await fetchAuthMe("http://api.example");
    expect(me).toEqual(user);
  });

  it("clears Pinia currentUser after logout API succeeds", async () => {
    setActivePinia(createPinia());
    const store = useHealthyApiStore();
    store.setCurrentUser({
      id: "u1",
      email: "a@b.com",
      displayName: "Owner",
      role: "owner",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/auth/logout")) {
          return { status: 204, ok: true };
        }
        throw new Error(`unexpected ${url}`);
      }) as unknown as typeof fetch,
    );
    await postAuthLogout("http://api.example");
    store.clearAuthenticatedState();
    expect(store.currentUser).toBeNull();
  });

  it("fetchAuthMe unauthorized matches startup gate unauthenticated branch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 401,
        ok: false,
        json: async () => ({ error: "unauthorized" }),
      })) as unknown as typeof fetch,
    );
    await expect(fetchAuthMe("http://api.example")).rejects.toBeInstanceOf(AuthMeUnauthorizedError);
  });
});
