import { isHealthyApiClientError } from "./healthyApiClient";
import { MissingAdminApiBaseUrlError } from "./firstOwnerOnboardingErrors";

/** User-facing copy for owner login failures from the Healthy API client. */
export function formatOwnerLoginError(error: unknown): string {
  if (isHealthyApiClientError(error)) {
    switch (error.kind) {
      case "invalid_credentials":
        return "Could not sign in. Check your email and password and try again.";
      case "login_invalid_input":
        return error.loginInvalidInput?.message ?? "The server could not accept this request. Check your input and try again.";
      case "service_unavailable":
        return "The API is temporarily unavailable. Try again in a moment.";
      case "network":
        return "Could not reach the API. Check your network connection and try again.";
      case "unexpected_http_status":
      case "success_body_invalid":
      case "error_body_invalid":
      case "invalid_json":
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
