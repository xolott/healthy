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

export const HEALTHY_API_PUBLIC_STATUS_ENDPOINT = {
  method: "GET" as const,
  path: "/status" as const,
};

export type HealthyApiPublicStatusEndpoint = typeof HEALTHY_API_PUBLIC_STATUS_ENDPOINT;

export type HealthyApiClientErrorKind =
  | "network"
  | "invalid_json"
  | "unexpected_http_status"
  | "success_body_invalid"
  | "error_body_invalid"
  | "service_unavailable";

export class HealthyApiClientError extends Error {
  readonly kind: HealthyApiClientErrorKind;
  readonly endpoint: HealthyApiPublicStatusEndpoint;
  readonly httpStatus?: number;

  constructor(args: {
    kind: HealthyApiClientErrorKind;
    message: string;
    httpStatus?: number;
    cause?: unknown;
  }) {
    super(args.message, args.cause !== undefined ? { cause: args.cause } : undefined);
    this.name = "HealthyApiClientError";
    this.kind = args.kind;
    this.endpoint = HEALTHY_API_PUBLIC_STATUS_ENDPOINT;
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

export type CreateHealthyApiClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
  defaultRequestInit?: RequestInit;
};

export type HealthyApiClient = {
  getPublicStatus(): Promise<HealthyPublicStatus>;
};

export function createHealthyApiClient(options: CreateHealthyApiClientOptions): HealthyApiClient {
  const normalizedBase = normalizeHealthyApiBaseUrl(options.baseUrl);
  const doFetch = options.fetch ?? globalThis.fetch;
  const defaultRequestInit = options.defaultRequestInit ?? {};

  return {
    async getPublicStatus() {
      const url = healthyApiPublicStatusUrl(normalizedBase);
      const headers = new Headers(defaultRequestInit.headers);
      headers.set("Accept", "application/json");
      const init: RequestInit = {
        ...defaultRequestInit,
        method: "GET",
        credentials: "omit",
        headers,
      };

      let res: Response;
      try {
        res = await doFetch(url, init);
      } catch (e) {
        throw new HealthyApiClientError({
          kind: "network",
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
            message: "Healthy API /status error response did not match the documented shape",
            httpStatus: 503,
            cause: parsed.error,
          });
        }
        throw new HealthyApiClientError({
          kind: "service_unavailable",
          message: "Healthy API reported service_unavailable",
          httpStatus: 503,
        });
      }

      throw new HealthyApiClientError({
        kind: "unexpected_http_status",
        message: `Healthy API returned HTTP ${String(res.status)}`,
        httpStatus: res.status,
      });
    },
  };
}
