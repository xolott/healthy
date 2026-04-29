import { describe, expect, it } from "vitest";

import { HealthyApiClientError, HEALTHY_API_FIRST_OWNER_SETUP_ENDPOINT } from "../../app/utils/healthyApiClient";
import {
  clientPasswordTooShortMessage,
  formatFirstOwnerOnboardingError,
  MissingAdminApiBaseUrlError,
} from "../../app/utils/firstOwnerOnboardingErrors";

describe("firstOwnerOnboardingErrors", () => {
  it("formats setup_password_policy using API message", () => {
    const err = new HealthyApiClientError({
      kind: "setup_password_policy",
      endpoint: HEALTHY_API_FIRST_OWNER_SETUP_ENDPOINT,
      message: "x",
      httpStatus: 400,
      setupPasswordPolicy: { minLength: 12, message: "Too weak" },
    });
    expect(formatFirstOwnerOnboardingError(err)).toBe("Too weak");
  });

  it("formats setup_invalid_input using API message", () => {
    const err = new HealthyApiClientError({
      kind: "setup_invalid_input",
      endpoint: HEALTHY_API_FIRST_OWNER_SETUP_ENDPOINT,
      message: "x",
      httpStatus: 400,
      setupInvalidInput: { field: "email", message: "Invalid" },
    });
    expect(formatFirstOwnerOnboardingError(err)).toBe("Invalid");
  });

  it("formats setup_unavailable (404 semantics)", () => {
    const err = new HealthyApiClientError({
      kind: "setup_unavailable",
      endpoint: HEALTHY_API_FIRST_OWNER_SETUP_ENDPOINT,
      message: "x",
      httpStatus: 404,
    });
    expect(formatFirstOwnerOnboardingError(err)).toContain("no longer available");
  });

  it("formats service_unavailable from client", () => {
    const err = new HealthyApiClientError({
      kind: "service_unavailable",
      endpoint: HEALTHY_API_FIRST_OWNER_SETUP_ENDPOINT,
      message: "x",
      httpStatus: 503,
    });
    expect(formatFirstOwnerOnboardingError(err)).toContain("temporarily unavailable");
  });

  it("formats network failures", () => {
    const err = new HealthyApiClientError({
      kind: "network",
      endpoint: HEALTHY_API_FIRST_OWNER_SETUP_ENDPOINT,
      message: "x",
    });
    expect(formatFirstOwnerOnboardingError(err)).toContain("Could not reach");
  });

  it("formats unexpected client failures with neutral copy", () => {
    const err = new HealthyApiClientError({
      kind: "invalid_json",
      endpoint: HEALTHY_API_FIRST_OWNER_SETUP_ENDPOINT,
      message: "x",
      httpStatus: 201,
    });
    expect(formatFirstOwnerOnboardingError(err)).toContain("unexpected way");
  });

  it("formats missing deployment API base URL", () => {
    expect(formatFirstOwnerOnboardingError(new MissingAdminApiBaseUrlError())).toContain(
      "NUXT_PUBLIC_API_BASE_URL",
    );
  });

  it("falls back for unknown failures", () => {
    expect(formatFirstOwnerOnboardingError(new Error("HTTP 418"))).toBe(
      "Request failed. Check the API and try again.",
    );
  });

  it("clientPasswordTooShortMessage states minimum length", () => {
    expect(clientPasswordTooShortMessage(12)).toContain("12");
  });
});
