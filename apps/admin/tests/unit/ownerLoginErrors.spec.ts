import { describe, expect, it } from "vitest";

import {
  ApiServiceUnavailableError,
  InvalidOwnerLoginInputError,
  OwnerLoginInvalidCredentialsError,
} from "../../app/utils/healthyApiAuth";
import { MissingAdminApiBaseUrlError } from "../../app/utils/firstOwnerOnboardingErrors";
import { formatOwnerLoginError } from "../../app/utils/ownerLoginErrors";

describe("formatOwnerLoginError", () => {
  it("maps invalid credentials to a neutral message", () => {
    expect(formatOwnerLoginError(new OwnerLoginInvalidCredentialsError())).toContain("Could not sign in");
  });

  it("surfaces API invalid_input messages", () => {
    expect(formatOwnerLoginError(new InvalidOwnerLoginInputError("email", "Email is invalid"))).toBe(
      "Email is invalid",
    );
  });

  it("maps service unavailable", () => {
    expect(formatOwnerLoginError(new ApiServiceUnavailableError())).toContain("temporarily unavailable");
  });

  it("maps missing API base URL", () => {
    expect(formatOwnerLoginError(new MissingAdminApiBaseUrlError())).toContain("NUXT_PUBLIC_API_BASE_URL");
  });

  it("maps ambiguous bad request", () => {
    expect(formatOwnerLoginError(new Error("Bad request"))).toContain("could not accept this request");
  });

  it("falls back for unknown errors", () => {
    expect(formatOwnerLoginError(new Error("HTTP 418"))).toBe("Request failed. Check the API and try again.");
  });
});
