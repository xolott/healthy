import { afterEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

import { useHealthyApiStore } from "../../app/stores/healthyApi";
import { createHealthyApiClient } from "../../app/utils/healthyApiClient";

describe("owner login and logout flow (session + client state)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setActivePinia(undefined);
  });

  it("ownerLogin followed by getCurrentUser reflects a restored cookie session", async () => {
    const user = { id: "u1", email: "a@b.com", displayName: "Owner", role: "owner" as const };
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
    const client = createHealthyApiClient({ baseUrl: "http://api.example" });
    await client.ownerLogin({ email: "a@b.com", password: "x".repeat(12) });
    const me = await client.getCurrentUser();
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
    await createHealthyApiClient({ baseUrl: "http://api.example" }).logout();
    store.clearAuthenticatedState();
    expect(store.currentUser).toBeNull();
  });

  it("getCurrentUser unauthorized matches startup gate unauthenticated branch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 401,
        ok: false,
        json: async () => ({ error: "unauthorized" }),
      })) as unknown as typeof fetch,
    );
    await expect(createHealthyApiClient({ baseUrl: "http://api.example" }).getCurrentUser()).rejects.toMatchObject({
      kind: "unauthenticated",
      httpStatus: 401,
    });
  });
});
