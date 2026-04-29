import {
  createHealthyApiClient,
  isHealthyApiClientError,
  type CreateHealthyApiClientOptions,
  type HealthyAuthMeUser,
} from "./healthyApiClient";

/**
 * Resolved current session user (`GET /auth/me`) via the Healthy API client.
 */
export async function fetchHealthyAuthMe(
  apiBaseUrl: string,
  options?: Omit<CreateHealthyApiClientOptions, "baseUrl">,
): Promise<HealthyAuthMeUser> {
  return createHealthyApiClient({ baseUrl: apiBaseUrl, ...options }).getCurrentUser();
}

/**
 * Maps `getCurrentUser` failures into global navigation `{ authMe }` inputs.
 * Mirrors `middleware/healthy-api.global.ts`.
 */
export function authMeProbeNavigationFromClientError(error: unknown): "unauthorized" | "error" {
  if (isHealthyApiClientError(error) && error.kind === "unauthenticated") {
    return "unauthorized";
  }
  return "error";
}
