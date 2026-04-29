import { describe, expect, it } from "vitest";

import {
  HEALTHY_API_OWNER_LOGIN_ENDPOINT,
  HealthyApiClientError,
} from "../../app/utils/healthyApiClient";
import { MissingAdminApiBaseUrlError } from "../../app/utils/firstOwnerOnboardingErrors";
import { formatOwnerLoginError } from "../../app/utils/ownerLoginErrors";

describe("formatOwnerLoginError", () => {
  it("maps invalid credentials to a neutral message", () => {
    expect(
      formatOwnerLoginError(
        new HealthyApiClientError({
          kind: "invalid_credentials",
          endpoint: HEALTHY_API_OWNER_LOGIN_ENDPOINT,
          message: "x",
          httpStatus: 401,
        }),
      ),
    ).toContain("Could not sign in");
  });

  it("surfaces API login_invalid_input messages via client metadata", () => {
    expect(
      formatOwnerLoginError(
        new HealthyApiClientError({
          kind: "login_invalid_input",
          endpoint: HEALTHY_API_OWNER_LOGIN_ENDPOINT,
          message: "x",
          httpStatus: 400,
          loginInvalidInput: { field: "email", message: "Email is invalid" },
        }),
      ),
    ).toBe("Email is invalid");
  });

  it("maps service_unavailable kind", () => {
    expect(
      formatOwnerLoginError(
        new HealthyApiClientError({
          kind: "service_unavailable",
          endpoint: HEALTHY_API_OWNER_LOGIN_ENDPOINT,
          message: "x",
          httpStatus: 503,
        }),
      ),
    ).toContain("temporarily unavailable");
  });

  it("maps missing API base URL", () => {
    expect(formatOwnerLoginError(new MissingAdminApiBaseUrlError())).toContain("NUXT_PUBLIC_API_BASE_URL");
  });

  it("maps network failures", () => {
    expect(
      formatOwnerLoginError(
        new HealthyApiClientError({
          kind: "network",
          endpoint: HEALTHY_API_OWNER_LOGIN_ENDPOINT,
          message: "x",
        }),
      ),
    ).toContain("Could not reach the API");
  });

  it("maps malformed or unexpected responses", () => {
    expect(
      formatOwnerLoginError(
        new HealthyApiClientError({
          kind: "error_body_invalid",
          endpoint: HEALTHY_API_OWNER_LOGIN_ENDPOINT,
          message: "x",
          httpStatus: 400,
        }),
      ),
    ).toContain("unexpected way");
  });

  it("falls back for unrelated errors", () => {
    expect(formatOwnerLoginError(new Error("HTTP 418"))).toBe("Request failed. Check the API and try again.");
  });
});
