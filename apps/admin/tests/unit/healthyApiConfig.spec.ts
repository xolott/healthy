import { describe, expect, it } from "vitest";

import { resolveConfiguredApiBaseUrl } from "../../app/utils/healthyApiConfig";

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
