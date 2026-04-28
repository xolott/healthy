import { resolveConfiguredApiBaseUrl } from "@/utils/healthyApiConfig";

/**
 * API base URL from runtime config only (not user-editable storage).
 */
export function useHealthyApiBaseUrl() {
  const config = useRuntimeConfig();
  return computed(() => resolveConfiguredApiBaseUrl(String(config.public.apiBaseUrl ?? "")));
}
