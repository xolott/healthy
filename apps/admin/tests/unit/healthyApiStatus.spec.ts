import { describe, expect, it, vi } from "vitest";

import {
  HealthyApiClientError,
  createHealthyApiClient,
  isHealthyApiClientError,
} from "../../app/utils/healthyApiClient";
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
        endpoint: { method: "GET", path: "/status" },
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

describe("isHealthyApiClientError", () => {
  it("narrows HealthyApiClientError", () => {
    const e = new HealthyApiClientError({ kind: "network", message: "x" });
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
