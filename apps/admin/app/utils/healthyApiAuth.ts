import {
  createHealthyApiClient,
  isHealthyApiClientError,
  type CreateHealthyApiClientOptions,
  type HealthyAuthMeUser,
} from "./healthyApiClient";

export const PASSWORD_MIN_LENGTH = 12;

/** Current admin user (`/auth/me` success body). Roles match documented API enums. */
export type CurrentUser = HealthyAuthMeUser;

export class AuthMeUnauthorizedError extends Error {
  constructor() {
    super("Not authenticated");
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
 * Create the first owner when setup is available. Sets the HttpOnly session cookie on the API origin.
 * Returns only the current user — the API includes a Bearer-oriented session in JSON; that shape is validated
 * but not returned, matching the owner login web contract.
 * Failures use `HealthyApiClientError` with closed `kind` values.
 */
export async function postFirstOwnerSetup(
  apiBaseUrl: string,
  input: { displayName: string; email: string; password: string },
  options?: Omit<CreateHealthyApiClientOptions, "baseUrl">,
): Promise<CurrentUser> {
  return createHealthyApiClient({ baseUrl: apiBaseUrl, ...options }).firstOwnerSetup(input);
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
