export const HEALTHY_PUBLIC_STATUS_QUERY_ROOT = "healthy-public-status" as const;

export function healthyPublicStatusQueryKey(apiBaseUrl: string) {
  return [HEALTHY_PUBLIC_STATUS_QUERY_ROOT, apiBaseUrl] as const;
}
