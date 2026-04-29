import {
  createHealthyApiClient,
  isHealthyApiClientError,
  type CreateHealthyApiClientOptions,
  type HealthyAuthMeUser,
} from "./healthyApiClient";

export const PASSWORD_MIN_LENGTH = 12;

/** Current admin user (`/auth/me` success body). Roles match documented API enums. */
export type CurrentUser = HealthyAuthMeUser;

export type FirstOwnerSuccessBody = {
  user: CurrentUser;
  session: { token: string; expiresAt: string };
};

export class AuthMeUnauthorizedError extends Error {
  constructor() {
    super("Not authenticated");
  }
}

export class SetupNotFoundError extends Error {
  constructor() {
    super("Setup is not available");
  }
}

export class PasswordPolicyApiError extends Error {
  constructor(
    public readonly minLength: number,
    message: string,
  ) {
    super(message);
  }
}

export class InvalidInputApiError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
  }
}

export class ApiServiceUnavailableError extends Error {
  constructor() {
    super("Server unavailable");
    this.name = "ApiServiceUnavailableError";
  }
}

/**
 * Fetches the current user using the API session (HttpOnly cookie and/or future Bearer token wiring).
 * Delegates to {@link createHealthyApiClient}; maps documented unauthenticated failures to {@link AuthMeUnauthorizedError}.
 */
export async function fetchAuthMe(
  apiBaseUrl: string,
  options?: Omit<CreateHealthyApiClientOptions, "baseUrl">,
): Promise<CurrentUser> {
  try {
    return await createHealthyApiClient({ baseUrl: apiBaseUrl, ...options }).getCurrentUser();
  } catch (e) {
    if (isHealthyApiClientError(e) && e.kind === "unauthenticated") {
      throw new AuthMeUnauthorizedError();
    }
    throw e;
  }
}

/**
 * Create the first owner. Stores HttpOnly session cookie for the API origin; returns response body for display.
 */
export async function postFirstOwnerSetup(
  apiBaseUrl: string,
  input: { displayName: string; email: string; password: string },
): Promise<FirstOwnerSuccessBody> {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/setup/first-owner`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 400) {
    const body: unknown = await res.json().catch(() => ({}));
    if (typeof body === "object" && body !== null) {
      const o = body as { error?: string; minLength?: number; message?: string; field?: string };
      if (o.error === "password_policy" && typeof o.minLength === "number" && typeof o.message === "string") {
        throw new PasswordPolicyApiError(o.minLength, o.message);
      }
      if (o.error === "invalid_input" && typeof o.field === "string" && typeof o.message === "string") {
        throw new InvalidInputApiError(o.field, o.message);
      }
    }
    throw new Error("Bad request");
  }
  if (res.status === 404) {
    throw new SetupNotFoundError();
  }
  if (res.status === 503) {
    throw new ApiServiceUnavailableError();
  }
  if (!res.ok) {
    throw new Error(`HTTP ${String(res.status)}`);
  }
  const body: unknown = await res.json();
  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid setup response");
  }
  const b = body as { user?: CurrentUser; session?: { token: string; expiresAt: string } };
  if (
    b.user === undefined ||
    b.session === undefined ||
    typeof b.session.token !== "string" ||
    typeof b.session.expiresAt !== "string"
  ) {
    throw new Error("Invalid setup response");
  }
  return { user: b.user, session: b.session };
}

/**
 * Owner login after setup is complete. Sets the HttpOnly session cookie on the API origin.
 * Returns only the current user — the API may include a Bearer token in JSON for mobile clients;
 * that value is validated for a well-formed response but is not returned, so web state stays cookie-only.
 * Failures use `HealthyApiClientError` with closed `kind` values.
 */
export async function postOwnerLogin(
  apiBaseUrl: string,
  input: { email: string; password: string },
  options?: Omit<CreateHealthyApiClientOptions, "baseUrl">,
): Promise<CurrentUser> {
  return createHealthyApiClient({ baseUrl: apiBaseUrl, ...options }).ownerLogin(input);
}

/**
 * Revokes the current API session (HttpOnly cookie and/or Bearer path via default fetch wiring).
 * Delegates to {@link createHealthyApiClient}; maps documented `503` `service_unavailable` to {@link ApiServiceUnavailableError}.
 */
export async function postAuthLogout(
  apiBaseUrl: string,
  options?: Omit<CreateHealthyApiClientOptions, "baseUrl">,
): Promise<void> {
  try {
    await createHealthyApiClient({ baseUrl: apiBaseUrl, ...options }).logout();
  } catch (e) {
    if (isHealthyApiClientError(e) && e.kind === "service_unavailable") {
      throw new ApiServiceUnavailableError();
    }
    throw e;
  }
}
