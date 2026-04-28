export const HEALTHY_PUBLIC_STATUS_QUERY_ROOT = "healthy-public-status" as const;
export const HEALTHY_AUTH_ME_QUERY_ROOT = "healthy-auth-me" as const;

export function healthyPublicStatusQueryKey(apiBaseUrl: string) {
  return [HEALTHY_PUBLIC_STATUS_QUERY_ROOT, apiBaseUrl] as const;
}

export function healthyAuthMeQueryKey(apiBaseUrl: string) {
  return [HEALTHY_AUTH_ME_QUERY_ROOT, apiBaseUrl] as const;
}
