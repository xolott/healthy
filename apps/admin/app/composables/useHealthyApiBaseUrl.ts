import { resolveConfiguredApiBaseUrlForAdminRequest } from "@/utils/healthyApiConfig";

/**
 * API base URL from runtime config only (not user-editable storage).
 * Loopback host (`localhost` vs `127.0.0.1`) matches the current admin request so session cookies apply.
 */
export function useHealthyApiBaseUrl() {
  const config = useRuntimeConfig();
  const requestURL = useRequestURL();
  return computed(() =>
    resolveConfiguredApiBaseUrlForAdminRequest(String(config.public.apiBaseUrl ?? ""), requestURL.hostname),
  );
}
