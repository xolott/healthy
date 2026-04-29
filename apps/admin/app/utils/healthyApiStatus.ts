import { createHealthyApiClient } from "./healthyApiClient";
import type { CreateHealthyApiClientOptions, HealthyPublicStatus } from "./healthyApiClient";

export function fetchHealthyPublicStatus(
  apiBaseUrl: string,
  options?: Omit<CreateHealthyApiClientOptions, "baseUrl">,
): Promise<HealthyPublicStatus> {
  return createHealthyApiClient({ baseUrl: apiBaseUrl, ...options }).getPublicStatus();
}
