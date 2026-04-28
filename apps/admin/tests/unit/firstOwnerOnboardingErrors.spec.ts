import { describe, expect, it } from "vitest";

import {
  ApiServiceUnavailableError,
  InvalidInputApiError,
  PasswordPolicyApiError,
  SetupNotFoundError,
} from "../../app/utils/healthyApiAuth";
import {
  clientPasswordTooShortMessage,
  formatFirstOwnerOnboardingError,
  MissingAdminApiBaseUrlError,
} from "../../app/utils/firstOwnerOnboardingErrors";

describe("firstOwnerOnboardingErrors", () => {
  it("formats password policy errors", () => {
    expect(formatFirstOwnerOnboardingError(new PasswordPolicyApiError(12, "Too weak"))).toBe("Too weak");
  });

  it("formats invalid_input from API", () => {
    expect(formatFirstOwnerOnboardingError(new InvalidInputApiError("email", "Invalid"))).toBe("Invalid");
  });

  it("formats setup unavailable (404 semantics)", () => {
    expect(formatFirstOwnerOnboardingError(new SetupNotFoundError())).toContain("no longer available");
  });

  it("formats API service unavailable", () => {
    expect(formatFirstOwnerOnboardingError(new ApiServiceUnavailableError())).toContain(
      "temporarily unavailable",
    );
  });

  it("formats missing deployment API base URL", () => {
    expect(formatFirstOwnerOnboardingError(new MissingAdminApiBaseUrlError())).toContain(
      "NUXT_PUBLIC_API_BASE_URL",
    );
  });

  it("formats ambiguous bad request bodies", () => {
    expect(formatFirstOwnerOnboardingError(new Error("Bad request"))).toContain(
      "could not accept this request",
    );
  });

  it("formats legacy HTTP unavailability strings", () => {
    expect(formatFirstOwnerOnboardingError(new Error("Server unavailable"))).toContain(
      "temporarily unavailable",
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
