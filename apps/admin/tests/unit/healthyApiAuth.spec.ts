import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiServiceUnavailableError,
  AuthMeUnauthorizedError,
  fetchAuthMe,
  InvalidInputApiError,
  PASSWORD_MIN_LENGTH,
  PasswordPolicyApiError,
  postAuthLogout,
  postFirstOwnerSetup,
  postOwnerLogin,
  SetupNotFoundError,
} from "../../app/utils/healthyApiAuth";
import { HEALTHY_API_AUTH_LOGOUT_ENDPOINT } from "../../app/utils/healthyApiClient";

describe("healthyApiAuth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes 12-char password minimum aligned with API policy", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12);
  });

  it("postOwnerLogin rejects with invalid_credentials on documented 401", async () => {
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
    ).rejects.toMatchObject({ kind: "invalid_credentials", httpStatus: 401 });
  });

  it("fetchAuthMe uses credentials include and returns user on 200", async () => {
    const user = { id: "u1", email: "a@b.com", displayName: "A", role: "owner" };
    const fetchMock = vi.fn(async () => ({
      status: 200,
      ok: true,
      json: async () => ({ user }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const out = await fetchAuthMe("https://api.example/");
    expect(out).toEqual(user);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example/auth/me",
      expect.objectContaining({
        credentials: "include",
        headers: expect.any(Headers),
      }),
    );
  });

  it("fetchAuthMe throws AuthMeUnauthorizedError on 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 401,
        ok: false,
        json: async () => ({ error: "unauthorized" }),
      })) as unknown as typeof fetch,
    );
    await expect(fetchAuthMe("https://api.example")).rejects.toBeInstanceOf(AuthMeUnauthorizedError);
  });

  it("rejects with error_body_invalid on 503 without documented body (session probe / restoration)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 503,
        ok: false,
        json: async () => ({}),
      })) as unknown as typeof fetch,
    );
    await expect(fetchAuthMe("https://api.example")).rejects.toMatchObject({
      kind: "error_body_invalid",
      httpStatus: 503,
    });
  });

  it("postOwnerLogin delegates to Healthy client JSON POST with credentials and parses user-only result", async () => {
    const user = { id: "u1", email: "a@b.com", displayName: "A", role: "owner" };
    const fetchMock = vi.fn(async () => ({
      status: 200,
      ok: true,
      json: async () => ({
        user,
        session: { token: "opaque-token", expiresAt: "2099-01-01T00:00:00.000Z" },
      }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const out = await postOwnerLogin("https://api.example/", {
      email: "a@b.com",
      password: "x".repeat(12),
    });
    expect(out).toEqual(user);
    expect(fetchMock).toHaveBeenCalledWith("https://api.example/auth/login", {
      method: "POST",
      credentials: "include",
      headers: expect.any(Headers),
      body: JSON.stringify({ email: "a@b.com", password: "x".repeat(12) }),
    });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const h = init.headers as Headers;
    expect(h.get("Accept")).toBe("application/json");
    expect(h.get("Content-Type")).toBe("application/json");
  });

  it("postOwnerLogin maps documented invalid_input 400 to login_invalid_input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 400,
        ok: false,
        json: async () => ({
          error: "invalid_input",
          field: "email",
          message: "Email is invalid",
        }),
      })) as unknown as typeof fetch,
    );
    await expect(
      postOwnerLogin("https://api.example", { email: "bad", password: "x".repeat(12) }),
    ).rejects.toMatchObject({
      kind: "login_invalid_input",
      loginInvalidInput: { field: "email", message: "Email is invalid" },
    });
  });

  it("postFirstOwnerSetup returns user and session on 201", async () => {
    const user = { id: "u1", email: "a@b.com", displayName: "A", role: "owner" };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 201,
        ok: true,
        json: async () => ({
          user,
          session: { token: "opaque-token", expiresAt: "2099-01-01T00:00:00.000Z" },
        }),
      })) as unknown as typeof fetch,
    );
    const out = await postFirstOwnerSetup("https://api.example/", {
      displayName: "A",
      email: "a@b.com",
      password: "x".repeat(12),
    });
    expect(out.user).toEqual(user);
    expect(out.session.token).toBe("opaque-token");
    expect(fetch).toHaveBeenCalledWith("https://api.example/setup/first-owner", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "A", email: "a@b.com", password: "x".repeat(12) }),
    });
  });

  it("postFirstOwnerSetup throws PasswordPolicyApiError on password_policy 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 400,
        ok: false,
        json: async () => ({
          error: "password_policy",
          minLength: 12,
          message: "Too short",
        }),
      })) as unknown as typeof fetch,
    );
    await expect(
      postFirstOwnerSetup("https://api.example", {
        displayName: "A",
        email: "a@b.com",
        password: "short",
      }),
    ).rejects.toBeInstanceOf(PasswordPolicyApiError);
  });

  it("postFirstOwnerSetup throws InvalidInputApiError on invalid_input 400", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 400,
        ok: false,
        json: async () => ({
          error: "invalid_input",
          field: "email",
          message: "Invalid",
        }),
      })) as unknown as typeof fetch,
    );
    await expect(
      postFirstOwnerSetup("https://api.example", {
        displayName: "A",
        email: "bad",
        password: "x".repeat(12),
      }),
    ).rejects.toBeInstanceOf(InvalidInputApiError);
  });

  it("postFirstOwnerSetup throws SetupNotFoundError on 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 404,
        ok: false,
        json: async () => ({ error: "not_found" }),
      })) as unknown as typeof fetch,
    );
    await expect(
      postFirstOwnerSetup("https://api.example/", {
        displayName: "A",
        email: "a@b.com",
        password: "x".repeat(12),
      }),
    ).rejects.toBeInstanceOf(SetupNotFoundError);
  });

  it("postFirstOwnerSetup throws ApiServiceUnavailableError on 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 503,
        ok: false,
        json: async () => ({}),
      })) as unknown as typeof fetch,
    );
    await expect(
      postFirstOwnerSetup("https://api.example/", {
        displayName: "A",
        email: "a@b.com",
        password: "x".repeat(12),
      }),
    ).rejects.toBeInstanceOf(ApiServiceUnavailableError);
  });

  it("postOwnerLogin rejects with error_body_invalid on 503 without documented body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 503,
        ok: false,
        json: async () => ({}),
      })) as unknown as typeof fetch,
    );
    await expect(
      postOwnerLogin("https://api.example", { email: "a@b.com", password: "x".repeat(12) }),
    ).rejects.toMatchObject({
      kind: "error_body_invalid",
      httpStatus: 503,
    });
  });

  it("postAuthLogout throws ApiServiceUnavailableError on documented 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 503,
        ok: false,
        json: async () => ({ error: "service_unavailable" }),
      })) as unknown as typeof fetch,
    );
    await expect(postAuthLogout("https://api.example/")).rejects.toBeInstanceOf(ApiServiceUnavailableError);
  });

  it("postAuthLogout POSTs with credentials and accepts 204 without a JSON body", async () => {
    const fetchMock = vi.fn(async () => ({
      status: 204,
      ok: true,
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    await postAuthLogout("https://api.example/");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example/auth/logout",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.any(Headers),
      }),
    );
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(((init.headers as Headers).get("Accept"))).toBe("application/json");
  });

  it("postAuthLogout surfaces unexpected statuses as HealthyApiClientError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 418,
        ok: false,
        json: async () => ({ teapot: true }),
      })) as unknown as typeof fetch,
    );
    await expect(postAuthLogout("https://api.example/")).rejects.toMatchObject({
      kind: "unexpected_http_status",
      httpStatus: 418,
      endpoint: HEALTHY_API_AUTH_LOGOUT_ENDPOINT,
    });
  });
});
