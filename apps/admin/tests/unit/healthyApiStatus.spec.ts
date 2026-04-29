import { describe, expect, it, vi } from "vitest";

import {
  HEALTHY_API_AUTH_LOGOUT_ENDPOINT,
  HEALTHY_API_AUTH_ME_ENDPOINT,
  HEALTHY_API_OWNER_LOGIN_ENDPOINT,
  HEALTHY_API_PUBLIC_STATUS_ENDPOINT,
  HealthyApiClientError,
  createHealthyApiClient,
  isHealthyApiClientError,
} from "../../app/utils/healthyApiClient";
import { fetchHealthyAuthMe, authMeProbeNavigationFromClientError } from "../../app/utils/healthyApiAuthMe";
import { fetchHealthyPublicStatus } from "../../app/utils/healthyApiStatus";

describe("createHealthyApiClient / getPublicStatus", () => {
  it("returns parsed body on 200", async () => {
    const payload = {
      api: { name: "healthy-api" as const, version: "0.0.1" },
      setupRequired: true,
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => payload,
    })) as unknown as typeof fetch;

    const client = createHealthyApiClient({
      baseUrl: "http://example.test",
      fetch: fetchMock,
    });
    await expect(client.getPublicStatus()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("http://example.test/status", {
      credentials: "omit",
      method: "GET",
      headers: expect.any(Headers),
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Headers).get("Accept")).toBe("application/json");
  });

  it("strips trailing slashes before calling /status", async () => {
    const payload = {
      api: { name: "healthy-api" as const, version: "0.0.1" },
      setupRequired: false,
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => payload,
    })) as unknown as typeof fetch;

    const client = createHealthyApiClient({
      baseUrl: "http://example.test/api/",
      fetch: fetchMock,
    });
    await client.getPublicStatus();
    expect(fetchMock).toHaveBeenCalledWith("http://example.test/api/status", expect.any(Object));
  });

  it("uses injected fetch and merges defaultRequestInit with client-owned fields taking precedence", async () => {
    const payload = {
      api: { name: "healthy-api" as const, version: "0.0.1" },
      setupRequired: false,
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => payload,
    })) as unknown as typeof fetch;

    const client = createHealthyApiClient({
      baseUrl: "http://example.test",
      fetch: fetchMock,
      defaultRequestInit: {
        credentials: "include",
        cache: "no-store",
        headers: { Accept: "text/plain", "X-Custom": "a" },
      },
    });
    await client.getPublicStatus();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe("omit");
    expect(init.cache).toBe("no-store");
    const h = init.headers as Headers;
    expect(h.get("Accept")).toBe("application/json");
    expect(h.get("X-Custom")).toBe("a");
  });

  it("rejects with service_unavailable on documented 503 body", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: "service_unavailable" }),
    })) as unknown as typeof fetch;

    const client = createHealthyApiClient({
      baseUrl: "http://127.0.0.1:3001",
      fetch: fetchMock,
    });
    try {
      await client.getPublicStatus();
      expect.fail("expected rejection");
    } catch (e) {
      expect(isHealthyApiClientError(e)).toBe(true);
      expect(e).toMatchObject({
        kind: "service_unavailable",
        httpStatus: 503,
        endpoint: HEALTHY_API_PUBLIC_STATUS_ENDPOINT,
      });
    }
  });

  it("rejects with error_body_invalid when 503 body is not documented", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: "other" }),
    })) as unknown as typeof fetch;

    const client = createHealthyApiClient({
      baseUrl: "http://example.test",
      fetch: fetchMock,
    });
    await expect(client.getPublicStatus()).rejects.toMatchObject({
      kind: "error_body_invalid",
      httpStatus: 503,
    });
  });

  it("rejects with success_body_invalid on 200 when body does not match Zod schema", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ api: { name: "healthy-api", version: "1" }, setupRequired: "yes" }),
    })) as unknown as typeof fetch;

    const client = createHealthyApiClient({
      baseUrl: "http://example.test",
      fetch: fetchMock,
    });
    await expect(client.getPublicStatus()).rejects.toMatchObject({
      kind: "success_body_invalid",
      httpStatus: 200,
    });
  });

  it("rejects with unexpected_http_status for other non-OK responses", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 404,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    const client = createHealthyApiClient({
      baseUrl: "http://example.test",
      fetch: fetchMock,
    });
    await expect(client.getPublicStatus()).rejects.toMatchObject({
      kind: "unexpected_http_status",
      httpStatus: 404,
    });
  });

  it("rejects with network kind when fetch throws", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    const client = createHealthyApiClient({
      baseUrl: "http://example.test",
      fetch: fetchMock,
    });
    await expect(client.getPublicStatus()).rejects.toMatchObject({
      kind: "network",
    });
  });
});

describe("createHealthyApiClient / getCurrentUser", () => {
  const ownerUser = {
    id: "u1",
    email: "a@b.com",
    displayName: "A",
    role: "owner" as const,
  };

  it("GETs /auth/me with credentials include", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ user: ownerUser }),
    })) as unknown as typeof fetch;

    const client = createHealthyApiClient({
      baseUrl: "http://example.test/",
      fetch: fetchMock,
    });

    await expect(client.getCurrentUser()).resolves.toEqual(ownerUser);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://example.test/auth/me",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        headers: expect.any(Headers),
      }),
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Headers).get("Accept")).toBe("application/json");
  });

  it("merges defaultRequestInit with essentials taking precedence", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ user: ownerUser }),
    })) as unknown as typeof fetch;

    const client = createHealthyApiClient({
      baseUrl: "http://example.test/",
      fetch: fetchMock,
      defaultRequestInit: {
        credentials: "omit",
        cache: "no-store",
        headers: { "X-T": "1" },
      },
    });
    await client.getCurrentUser();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe("include");
    expect(init.cache).toBe("no-store");
    const h = init.headers as Headers;
    expect(h.get("Accept")).toBe("application/json");
    expect(h.get("X-T")).toBe("1");
  });

  it("throws unauthenticated for documented 401 body", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "unauthorized" }),
    })) as unknown as typeof fetch;

    await expect(createHealthyApiClient({ baseUrl: "http://example.test/", fetch: fetchMock }).getCurrentUser()).rejects.toMatchObject({
      kind: "unauthenticated",
      endpoint: HEALTHY_API_AUTH_ME_ENDPOINT,
      httpStatus: 401,
    });
  });

  it("throws error_body_invalid on 401 without documented shape", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "nope" }),
    })) as unknown as typeof fetch;

    await expect(createHealthyApiClient({ baseUrl: "http://example.test/", fetch: fetchMock }).getCurrentUser()).rejects.toMatchObject({
      kind: "error_body_invalid",
      endpoint: HEALTHY_API_AUTH_ME_ENDPOINT,
    });
  });

  it("maps authMe probe outcomes like global middleware", () => {
    expect(authMeProbeNavigationFromClientError(new HealthyApiClientError({ kind: "unauthenticated", endpoint: HEALTHY_API_AUTH_ME_ENDPOINT, message: "" }))).toBe(
      "unauthorized",
    );
    expect(authMeProbeNavigationFromClientError(new HealthyApiClientError({ kind: "network", endpoint: HEALTHY_API_AUTH_ME_ENDPOINT, message: "" }))).toBe("error");
  });

  it("rejects with error_body_invalid for 503 malformed body", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(createHealthyApiClient({ baseUrl: "http://example.test/", fetch: fetchMock }).getCurrentUser()).rejects.toMatchObject({
      kind: "error_body_invalid",
      httpStatus: 503,
    });
  });

  it("rejects with unexpected_http_status for undocumented status", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 418,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(createHealthyApiClient({ baseUrl: "http://example.test/", fetch: fetchMock }).getCurrentUser()).rejects.toMatchObject({
      kind: "unexpected_http_status",
      httpStatus: 418,
    });
  });

  it("rejects success_body_invalid on 200 malformed user", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: "u1", email: "", displayName: "", role: "superadmin" } }),
    })) as unknown as typeof fetch;

    await expect(createHealthyApiClient({ baseUrl: "http://example.test/", fetch: fetchMock }).getCurrentUser()).rejects.toMatchObject({
      kind: "success_body_invalid",
      httpStatus: 200,
    });
  });

  it("rejects with service_unavailable for documented 503 body", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: "service_unavailable" }),
    })) as unknown as typeof fetch;

    await expect(createHealthyApiClient({ baseUrl: "http://example.test/", fetch: fetchMock }).getCurrentUser()).rejects.toMatchObject({
      kind: "service_unavailable",
      httpStatus: 503,
    });
  });
});

describe("createHealthyApiClient / ownerLogin", () => {
  const ownerUser = {
    id: "u1",
    email: "a@b.com",
    displayName: "A",
    role: "owner" as const,
  };

  it("POSTs JSON to /auth/login with credentials and required JSON headers", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        user: ownerUser,
        session: { token: "tok", expiresAt: "2099-01-01T00:00:00.000Z" },
      }),
    })) as unknown as typeof fetch;

    const client = createHealthyApiClient({
      baseUrl: "http://example.test/",
      fetch: fetchMock,
    });

    await expect(
      client.ownerLogin({ email: "a@b.com", password: "x".repeat(12) }),
    ).resolves.toEqual(ownerUser);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://example.test/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.any(Headers),
        body: JSON.stringify({ email: "a@b.com", password: "x".repeat(12) }),
      }),
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const h = init.headers as Headers;
    expect(h.get("Accept")).toBe("application/json");
    expect(h.get("Content-Type")).toBe("application/json");
  });

  it("merges defaultRequestInit with client-owned POST essentials taking precedence", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        user: ownerUser,
        session: { token: "tok", expiresAt: "2099-01-01T00:00:00.000Z" },
      }),
    })) as unknown as typeof fetch;

    const client = createHealthyApiClient({
      baseUrl: "http://example.test",
      fetch: fetchMock,
      defaultRequestInit: {
        credentials: "omit",
        cache: "no-store",
        headers: { "X-T": "1" },
      },
    });
    await client.ownerLogin({ email: "a@b.com", password: "x".repeat(12) });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe("include");
    expect(init.cache).toBe("no-store");
    const h = init.headers as Headers;
    expect(h.get("Content-Type")).toBe("application/json");
    expect(h.get("X-T")).toBe("1");
  });

  it("returns only the user on 200 (session token validated, not returned)", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        user: ownerUser,
        session: { token: "opaque", expiresAt: "2099-01-01T00:00:00.000Z" },
      }),
    })) as unknown as typeof fetch;

    const out = await createHealthyApiClient({ baseUrl: "http://example.test", fetch: fetchMock }).ownerLogin({
      email: "a@b.com",
      password: "x".repeat(12),
    });
    expect(out).toEqual(ownerUser);
  });

  it("throws success_body_invalid on 200 when session shape is wrong", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ user: ownerUser, session: { token: 1 } }),
    })) as unknown as typeof fetch;

    await expect(
      createHealthyApiClient({ baseUrl: "http://example.test", fetch: fetchMock }).ownerLogin({
        email: "a@b.com",
        password: "x".repeat(12),
      }),
    ).rejects.toMatchObject({
      kind: "success_body_invalid",
      endpoint: HEALTHY_API_OWNER_LOGIN_ENDPOINT,
      httpStatus: 200,
    });
  });

  it("throws login_invalid_input for documented 400 body", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: "invalid_input",
        field: "password",
        message: "Too short",
      }),
    })) as unknown as typeof fetch;

    await expect(
      createHealthyApiClient({ baseUrl: "http://example.test", fetch: fetchMock }).ownerLogin({
        email: "a@b.com",
        password: "short",
      }),
    ).rejects.toMatchObject({
      kind: "login_invalid_input",
      endpoint: HEALTHY_API_OWNER_LOGIN_ENDPOINT,
      loginInvalidInput: { field: "password", message: "Too short" },
    });
  });

  it("throws error_body_invalid on 400 without documented shape", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "other" }),
    })) as unknown as typeof fetch;

    await expect(
      createHealthyApiClient({ baseUrl: "http://example.test", fetch: fetchMock }).ownerLogin({
        email: "a@b.com",
        password: "x".repeat(12),
      }),
    ).rejects.toMatchObject({
      kind: "error_body_invalid",
      endpoint: HEALTHY_API_OWNER_LOGIN_ENDPOINT,
      httpStatus: 400,
    });
  });

  it("throws invalid_credentials for documented 401 body", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "invalid_credentials" }),
    })) as unknown as typeof fetch;

    await expect(
      createHealthyApiClient({ baseUrl: "http://example.test", fetch: fetchMock }).ownerLogin({
        email: "a@b.com",
        password: "x".repeat(12),
      }),
    ).rejects.toMatchObject({
      kind: "invalid_credentials",
      endpoint: HEALTHY_API_OWNER_LOGIN_ENDPOINT,
      httpStatus: 401,
    });
  });

  it("throws error_body_invalid on 401 without documented shape", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "unauthorized" }),
    })) as unknown as typeof fetch;

    await expect(
      createHealthyApiClient({ baseUrl: "http://example.test", fetch: fetchMock }).ownerLogin({
        email: "a@b.com",
        password: "x".repeat(12),
      }),
    ).rejects.toMatchObject({
      kind: "error_body_invalid",
      endpoint: HEALTHY_API_OWNER_LOGIN_ENDPOINT,
      httpStatus: 401,
    });
  });

  it("throws service_unavailable for documented 503 body", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: "service_unavailable" }),
    })) as unknown as typeof fetch;

    await expect(
      createHealthyApiClient({ baseUrl: "http://example.test", fetch: fetchMock }).ownerLogin({
        email: "a@b.com",
        password: "x".repeat(12),
      }),
    ).rejects.toMatchObject({
      kind: "service_unavailable",
      endpoint: HEALTHY_API_OWNER_LOGIN_ENDPOINT,
      httpStatus: 503,
    });
  });

  it("throws unexpected_http_status for undocumented HTTP codes", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(
      createHealthyApiClient({ baseUrl: "http://example.test", fetch: fetchMock }).ownerLogin({
        email: "a@b.com",
        password: "x".repeat(12),
      }),
    ).rejects.toMatchObject({
      kind: "unexpected_http_status",
      httpStatus: 429,
    });
  });

  it("throws network kind when fetch throws", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    await expect(
      createHealthyApiClient({ baseUrl: "http://example.test", fetch: fetchMock }).ownerLogin({
        email: "a@b.com",
        password: "x".repeat(12),
      }),
    ).rejects.toMatchObject({
      kind: "network",
      endpoint: HEALTHY_API_OWNER_LOGIN_ENDPOINT,
    });
  });
});

describe("createHealthyApiClient / logout", () => {
  it("resolves on 204 without reading JSON", async () => {
    const jsonSpy = vi.fn(async () => ({}));
    const fetchMock = vi.fn(async () => ({
      status: 204,
      ok: true,
      json: jsonSpy,
    })) as unknown as typeof fetch;

    await expect(
      createHealthyApiClient({ baseUrl: "http://example.test", fetch: fetchMock }).logout(),
    ).resolves.toBeUndefined();
    expect(jsonSpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith("http://example.test/auth/logout", expect.any(Object));
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.credentials).toBe("include");
  });

  it("throws unexpected_http_status for non-204 non-503 statuses", async () => {
    const fetchMock = vi.fn(async () => ({
      status: 500,
      ok: false,
      json: async () => ({ error: "boom" }),
    })) as unknown as typeof fetch;

    await expect(
      createHealthyApiClient({ baseUrl: "http://example.test/", fetch: fetchMock }).logout(),
    ).rejects.toMatchObject({
      kind: "unexpected_http_status",
      endpoint: HEALTHY_API_AUTH_LOGOUT_ENDPOINT,
      httpStatus: 500,
    });
  });

  it("reports service_unavailable on documented 503 body", async () => {
    const fetchMock = vi.fn(async () => ({
      status: 503,
      ok: false,
      json: async () => ({ error: "service_unavailable" }),
    })) as unknown as typeof fetch;

    await expect(
      createHealthyApiClient({ baseUrl: "http://example.test", fetch: fetchMock }).logout(),
    ).rejects.toMatchObject({
      kind: "service_unavailable",
      endpoint: HEALTHY_API_AUTH_LOGOUT_ENDPOINT,
      httpStatus: 503,
    });
  });
});

describe("fetchHealthyAuthMe", () => {
  it("delegates to createHealthyApiClient#getCurrentUser", async () => {
    const payload = {
      user: {
        id: "u1",
        email: "a@b.com",
        displayName: "X",
        role: "member" as const,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => payload,
      })) as unknown as typeof fetch,
    );
    try {
      await expect(fetchHealthyAuthMe("http://example.test")).resolves.toEqual(payload.user);
      expect(fetch).toHaveBeenCalledWith("http://example.test/auth/me", expect.any(Object));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("isHealthyApiClientError", () => {
  it("narrows HealthyApiClientError", () => {
    const e = new HealthyApiClientError({
      kind: "network",
      endpoint: HEALTHY_API_PUBLIC_STATUS_ENDPOINT,
      message: "x",
    });
    expect(isHealthyApiClientError(e)).toBe(true);
    expect(isHealthyApiClientError(new Error("x"))).toBe(false);
  });
});

describe("fetchHealthyPublicStatus", () => {
  it("delegates to createHealthyApiClient", async () => {
    const payload = {
      api: { name: "healthy-api" as const, version: "0.0.1" },
      setupRequired: true,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => payload,
      })) as unknown as typeof fetch,
    );
    try {
      await expect(fetchHealthyPublicStatus("http://example.test")).resolves.toEqual(payload);
      expect(fetch).toHaveBeenCalledWith("http://example.test/status", expect.any(Object));
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
