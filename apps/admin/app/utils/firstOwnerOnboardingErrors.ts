import { isHealthyApiClientError } from "./healthyApiClient";

/** Thrown when submitting setup without a usable configured API origin. */
export class MissingAdminApiBaseUrlError extends Error {
  constructor() {
    super("missing_admin_api_base_url");
    this.name = "MissingAdminApiBaseUrlError";
  }
}

/** User-facing copy for first-owner onboarding and the post-setup logout handoff. */
export function formatFirstOwnerOnboardingError(error: unknown): string {
  if (isHealthyApiClientError(error)) {
    switch (error.kind) {
      case "setup_password_policy":
        return error.setupPasswordPolicy?.message ?? "The password does not meet the server requirements.";
      case "setup_invalid_input":
        return error.setupInvalidInput?.message ?? "The server could not accept this request. Check your input and try again.";
      case "setup_unavailable":
        return "Setup is no longer available. Try signing in if the server is already configured.";
      case "invalid_credentials":
      case "login_invalid_input":
        return "The API responded in an unexpected way. Try again, or verify this admin build matches the deployed API.";
      case "service_unavailable":
        return "The API is temporarily unavailable. Try again in a moment.";
      case "network":
        return "Could not reach the API. Check your network connection and try again.";
      case "unexpected_http_status":
      case "success_body_invalid":
      case "error_body_invalid":
      case "invalid_json":
      case "unauthenticated":
        return "The API responded in an unexpected way. Try again, or verify this admin build matches the deployed API.";
      default:
        break;
    }
  }

  if (error instanceof MissingAdminApiBaseUrlError) {
    return "API base URL is missing or invalid. Configure NUXT_PUBLIC_API_BASE_URL for this deployment.";
  }

  return "Request failed. Check the API and try again.";
}

export function clientPasswordTooShortMessage(passwordMinLength: number): string {
  return `Password must be at least ${String(passwordMinLength)} characters.`;
}
