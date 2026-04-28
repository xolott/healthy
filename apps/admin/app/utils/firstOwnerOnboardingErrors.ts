import {
  ApiServiceUnavailableError,
  InvalidInputApiError,
  PasswordPolicyApiError,
  SetupNotFoundError,
} from "./healthyApiAuth";

/** Thrown when submitting setup without a usable configured API origin. */
export class MissingAdminApiBaseUrlError extends Error {
  constructor() {
    super("missing_admin_api_base_url");
    this.name = "MissingAdminApiBaseUrlError";
  }
}

export function formatFirstOwnerOnboardingError(error: unknown): string {
  if (error instanceof PasswordPolicyApiError) {
    return error.message;
  }
  if (error instanceof InvalidInputApiError) {
    return error.message;
  }
  if (error instanceof SetupNotFoundError) {
    return "Setup is no longer available. Try signing in if the server is already configured.";
  }
  if (error instanceof ApiServiceUnavailableError) {
    return "The API is temporarily unavailable. Try again in a moment.";
  }
  if (error instanceof MissingAdminApiBaseUrlError) {
    return "API base URL is missing or invalid. Configure NUXT_PUBLIC_API_BASE_URL for this deployment.";
  }
  if (error instanceof Error && error.message === "Bad request") {
    return "The server could not accept this request. Check your input and try again.";
  }
  if (error instanceof Error && error.message === "Server unavailable") {
    return "The API is temporarily unavailable. Try again in a moment.";
  }
  return "Request failed. Check the API and try again.";
}

export function clientPasswordTooShortMessage(passwordMinLength: number): string {
  return `Password must be at least ${String(passwordMinLength)} characters.`;
}
