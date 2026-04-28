import { describe, expect, it, vi } from "vitest";

import {
  fetchHealthyPublicStatus,
  parseHealthyPublicStatus,
} from "../../app/utils/healthyApiStatus";

describe("parseHealthyPublicStatus", () => {
  it("accepts setup-complete shape", () => {
    const body = {
      api: { name: "healthy-api", version: "0.0.1" },
      setupRequired: false,
    };
    expect(parseHealthyPublicStatus(body)).toEqual(body);
  });

  it("accepts setup-required shape", () => {
    const body = {
      api: { name: "healthy-api", version: "0.0.1" },
      setupRequired: true,
    };
    expect(parseHealthyPublicStatus(body)).toEqual(body);
  });

  it("rejects wrong api name", () => {
    expect(() =>
      parseHealthyPublicStatus({
        api: { name: "other", version: "1" },
        setupRequired: true,
      }),
    ).toThrow();
  });

  it("rejects missing setupRequired", () => {
    expect(() =>
      parseHealthyPublicStatus({
        api: { name: "healthy-api", version: "1" },
      }),
    ).toThrow();
  });
});

describe("fetchHealthyPublicStatus", () => {
  it("throws on non-OK HTTP (connection / server validation failure)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({}),
      })) as unknown as typeof fetch,
    );
    try {
      await expect(fetchHealthyPublicStatus("http://127.0.0.1:3001")).rejects.toThrow("HTTP 503");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns parsed body on success", async () => {
    const payload = {
      api: { name: "healthy-api", version: "0.0.1" },
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
      expect(fetch).toHaveBeenCalledWith("http://example.test/status");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("strips trailing slashes before calling /status", async () => {
    const payload = {
      api: { name: "healthy-api", version: "0.0.1" },
      setupRequired: false,
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
      await fetchHealthyPublicStatus("http://example.test/api/");
      expect(fetch).toHaveBeenCalledWith("http://example.test/api/status");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
