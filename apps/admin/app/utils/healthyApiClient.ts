import { z } from "zod";

const healthyPublicStatusSuccessSchema = z
  .object({
    api: z
      .object({
        name: z.literal("healthy-api"),
        version: z.string(),
      })
      .strict(),
    setupRequired: z.boolean(),
  })
  .strict();

const statusServiceUnavailableBodySchema = z
  .object({
    error: z.literal("service_unavailable"),
  })
  .strict();

export type HealthyPublicStatus = z.infer<typeof healthyPublicStatusSuccessSchema>;

/** Documented `/auth/me` success user payload (roles match API Fastify schema). */
const authMeUserSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    displayName: z.string(),
    role: z.enum(["owner", "admin", "member"]),
  })
  .strict();

const authMeSuccessSchema = z
  .object({
    user: authMeUserSchema,
  })
  .strict();

const authMeUnauthorizedBodySchema = z
  .object({
    error: z.literal("unauthorized"),
  })
  .strict();

const authMeServiceUnavailableBodySchema = z
  .object({
    error: z.literal("service_unavailable"),
  })
  .strict();

export type HealthyAuthMeUser = z.infer<typeof authMeUserSchema>;

export const HEALTHY_API_PUBLIC_STATUS_ENDPOINT = {
  method: "GET" as const,
  path: "/status" as const,
};

export const HEALTHY_API_AUTH_ME_ENDPOINT = {
  method: "GET" as const,
  path: "/auth/me" as const,
};

export type HealthyApiPublicStatusEndpoint = typeof HEALTHY_API_PUBLIC_STATUS_ENDPOINT;
export type HealthyApiAuthMeEndpoint = typeof HEALTHY_API_AUTH_ME_ENDPOINT;

export type HealthyApiClientEndpoint = HealthyApiPublicStatusEndpoint | HealthyApiAuthMeEndpoint;

export type HealthyApiClientErrorKind =
  | "network"
  | "invalid_json"
  | "unexpected_http_status"
  | "success_body_invalid"
  | "error_body_invalid"
  | "service_unavailable"
  /** Documented `401` with `{ error: "unauthorized" }` on `/auth/me`. */
  | "unauthenticated";

export class HealthyApiClientError extends Error {
  readonly kind: HealthyApiClientErrorKind;
  readonly endpoint: HealthyApiClientEndpoint;
  readonly httpStatus?: number;

  constructor(args: {
    kind: HealthyApiClientErrorKind;
    endpoint: HealthyApiClientEndpoint;
    message: string;
    httpStatus?: number;
    cause?: unknown;
  }) {
    super(args.message, args.cause !== undefined ? { cause: args.cause } : undefined);
    this.name = "HealthyApiClientError";
    this.kind = args.kind;
    this.endpoint = args.endpoint;
    this.httpStatus = args.httpStatus;
  }
}

export function isHealthyApiClientError(e: unknown): e is HealthyApiClientError {
  return e instanceof HealthyApiClientError;
}

export function normalizeHealthyApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, "");
}

export function healthyApiPublicStatusUrl(normalizedBaseUrl: string): string {
  return `${normalizedBaseUrl}${HEALTHY_API_PUBLIC_STATUS_ENDPOINT.path}`;
}

export function healthyApiAuthMeUrl(normalizedBaseUrl: string): string {
  return `${normalizedBaseUrl}${HEALTHY_API_AUTH_ME_ENDPOINT.path}`;
}

export type CreateHealthyApiClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
  defaultRequestInit?: RequestInit;
};

export type HealthyApiClient = {
  getPublicStatus(): Promise<HealthyPublicStatus>;
  getCurrentUser(): Promise<HealthyAuthMeUser>;
};

function mergeFetchInit(defaultRequestInit: RequestInit, override: RequestInit): RequestInit {
  const headers = new Headers(defaultRequestInit.headers);
  const overrideHeaders = override.headers;
  if (overrideHeaders instanceof Headers) {
    overrideHeaders.forEach((value, key) => {
      headers.set(key, value);
    });
  } else if (overrideHeaders !== undefined && typeof overrideHeaders === "object") {
    for (const [key, value] of Object.entries(overrideHeaders)) {
      if (value !== undefined) {
        headers.set(key, String(value));
      }
    }
  }
  return {
    ...defaultRequestInit,
    ...override,
    headers,
  };
}

export function createHealthyApiClient(options: CreateHealthyApiClientOptions): HealthyApiClient {
  const normalizedBase = normalizeHealthyApiBaseUrl(options.baseUrl);
  const doFetch = options.fetch ?? globalThis.fetch;
  const defaultRequestInit = options.defaultRequestInit ?? {};

  return {
    async getPublicStatus() {
      const url = healthyApiPublicStatusUrl(normalizedBase);
      const headers = new Headers(defaultRequestInit.headers);
      headers.set("Accept", "application/json");
      const init = mergeFetchInit(defaultRequestInit, {
        method: "GET",
        credentials: "omit",
        headers,
      });

      let res: Response;
      try {
        res = await doFetch(url, init);
      } catch (e) {
        throw new HealthyApiClientError({
          kind: "network",
          endpoint: HEALTHY_API_PUBLIC_STATUS_ENDPOINT,
          message: "Healthy API request failed",
          cause: e,
        });
      }

      let body: unknown;
      try {
        body = await res.json();
      } catch (e) {
        throw new HealthyApiClientError({
          kind: "invalid_json",
          endpoint: HEALTHY_API_PUBLIC_STATUS_ENDPOINT,
          message: "Healthy API response was not valid JSON",
          httpStatus: res.status,
          cause: e,
        });
      }

      if (res.status === 200) {
        const parsed = healthyPublicStatusSuccessSchema.safeParse(body);
        if (!parsed.success) {
          throw new HealthyApiClientError({
            kind: "success_body_invalid",
            endpoint: HEALTHY_API_PUBLIC_STATUS_ENDPOINT,
            message: "Healthy API /status response did not match the expected shape",
            httpStatus: 200,
            cause: parsed.error,
          });
        }
        return parsed.data;
      }

      if (res.status === 503) {
        const parsed = statusServiceUnavailableBodySchema.safeParse(body);
        if (!parsed.success) {
          throw new HealthyApiClientError({
            kind: "error_body_invalid",
            endpoint: HEALTHY_API_PUBLIC_STATUS_ENDPOINT,
            message: "Healthy API /status error response did not match the documented shape",
            httpStatus: 503,
            cause: parsed.error,
          });
        }
        throw new HealthyApiClientError({
          kind: "service_unavailable",
          endpoint: HEALTHY_API_PUBLIC_STATUS_ENDPOINT,
          message: "Healthy API reported service_unavailable",
          httpStatus: 503,
        });
      }

      throw new HealthyApiClientError({
        kind: "unexpected_http_status",
        endpoint: HEALTHY_API_PUBLIC_STATUS_ENDPOINT,
        message: `Healthy API returned HTTP ${String(res.status)}`,
        httpStatus: res.status,
      });
    },

    async getCurrentUser() {
      const url = healthyApiAuthMeUrl(normalizedBase);
      const headers = new Headers(defaultRequestInit.headers);
      headers.set("Accept", "application/json");
      const init = mergeFetchInit(defaultRequestInit, {
        method: "GET",
        credentials: "include",
        headers,
      });

      let res: Response;
      try {
        res = await doFetch(url, init);
      } catch (e) {
        throw new HealthyApiClientError({
          kind: "network",
          endpoint: HEALTHY_API_AUTH_ME_ENDPOINT,
          message: "Healthy API request failed",
          cause: e,
        });
      }

      let body: unknown;
      try {
        body = await res.json();
      } catch (e) {
        throw new HealthyApiClientError({
          kind: "invalid_json",
          endpoint: HEALTHY_API_AUTH_ME_ENDPOINT,
          message: "Healthy API response was not valid JSON",
          httpStatus: res.status,
          cause: e,
        });
      }

      if (res.status === 200) {
        const parsed = authMeSuccessSchema.safeParse(body);
        if (!parsed.success) {
          throw new HealthyApiClientError({
            kind: "success_body_invalid",
            endpoint: HEALTHY_API_AUTH_ME_ENDPOINT,
            message: "Healthy API /auth/me response did not match the expected shape",
            httpStatus: 200,
            cause: parsed.error,
          });
        }
        return parsed.data.user;
      }

      if (res.status === 401) {
        const parsed = authMeUnauthorizedBodySchema.safeParse(body);
        if (!parsed.success) {
          throw new HealthyApiClientError({
            kind: "error_body_invalid",
            endpoint: HEALTHY_API_AUTH_ME_ENDPOINT,
            message: "Healthy API /auth/me error response did not match the documented shape",
            httpStatus: 401,
            cause: parsed.error,
          });
        }
        throw new HealthyApiClientError({
          kind: "unauthenticated",
          endpoint: HEALTHY_API_AUTH_ME_ENDPOINT,
          message: "Healthy API session is not authenticated",
          httpStatus: 401,
        });
      }

      if (res.status === 503) {
        const parsed = authMeServiceUnavailableBodySchema.safeParse(body);
        if (!parsed.success) {
          throw new HealthyApiClientError({
            kind: "error_body_invalid",
            endpoint: HEALTHY_API_AUTH_ME_ENDPOINT,
            message: "Healthy API /auth/me error response did not match the documented shape",
            httpStatus: 503,
            cause: parsed.error,
          });
        }
        throw new HealthyApiClientError({
          kind: "service_unavailable",
          endpoint: HEALTHY_API_AUTH_ME_ENDPOINT,
          message: "Healthy API reported service_unavailable",
          httpStatus: 503,
        });
      }

      throw new HealthyApiClientError({
        kind: "unexpected_http_status",
        endpoint: HEALTHY_API_AUTH_ME_ENDPOINT,
        message: `Healthy API returned HTTP ${String(res.status)}`,
        httpStatus: res.status,
      });
    },
  };
}
