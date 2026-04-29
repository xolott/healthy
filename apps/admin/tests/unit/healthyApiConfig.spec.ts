import { describe, expect, it } from "vitest";

import {
  alignApiBaseUrlWithAdminHostname,
  resolveConfiguredApiBaseUrl,
  resolveConfiguredApiBaseUrlForAdminRequest,
} from "../../app/utils/healthyApiConfig";

describe("alignApiBaseUrlWithAdminHostname", () => {
  it("rewrites 127.0.0.1 to localhost when admin is localhost", () => {
    expect(alignApiBaseUrlWithAdminHostname("http://127.0.0.1:3001", "localhost")).toBe(
      "http://localhost:3001",
    );
  });

  it("rewrites localhost to 127.0.0.1 when admin is 127.0.0.1", () => {
    expect(alignApiBaseUrlWithAdminHostname("http://localhost:3001", "127.0.0.1")).toBe(
      "http://127.0.0.1:3001",
    );
  });

  it("is a no-op when already aligned", () => {
    expect(alignApiBaseUrlWithAdminHostname("http://localhost:3001", "localhost")).toBe(
      "http://localhost:3001",
    );
  });

  it("does not change non-loopback API hosts", () => {
    expect(alignApiBaseUrlWithAdminHostname("https://api.example.com", "localhost")).toBe(
      "https://api.example.com",
    );
  });

  it("does not change API URL when admin host is not loopback", () => {
    expect(alignApiBaseUrlWithAdminHostname("http://127.0.0.1:3001", "admin.example.test")).toBe(
      "http://127.0.0.1:3001",
    );
  });
});

describe("resolveConfiguredApiBaseUrlForAdminRequest", () => {
  it("chains validation and loopback alignment", () => {
    expect(resolveConfiguredApiBaseUrlForAdminRequest("http://127.0.0.1:3001", "localhost")).toEqual({
      ok: true,
      baseUrl: "http://localhost:3001",
    });
  });
});

describe("resolveConfiguredApiBaseUrl", () => {
  it("returns missing for empty or whitespace", () => {
    expect(resolveConfiguredApiBaseUrl(undefined)).toEqual({ ok: false, reason: "missing" });
    expect(resolveConfiguredApiBaseUrl("")).toEqual({ ok: false, reason: "missing" });
    expect(resolveConfiguredApiBaseUrl("   ")).toEqual({ ok: false, reason: "missing" });
  });

  it("returns invalid_url for non-http(s) schemes", () => {
    expect(resolveConfiguredApiBaseUrl("ftp://example.com")).toEqual({
      ok: false,
      reason: "invalid_url",
    });
  });

  it("returns invalid_url for non-URL strings", () => {
    expect(resolveConfiguredApiBaseUrl("not a url")).toEqual({ ok: false, reason: "invalid_url" });
  });

  it("accepts http(s) origins and strips trailing slashes", () => {
    expect(resolveConfiguredApiBaseUrl("http://127.0.0.1:3001")).toEqual({
      ok: true,
      baseUrl: "http://127.0.0.1:3001",
    });
    expect(resolveConfiguredApiBaseUrl("https://api.example.test/path///")).toEqual({
      ok: true,
      baseUrl: "https://api.example.test/path",
    });
  });
});
