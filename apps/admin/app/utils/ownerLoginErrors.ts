import {
  ApiServiceUnavailableError,
  InvalidOwnerLoginInputError,
  OwnerLoginInvalidCredentialsError,
} from "./healthyApiAuth";
import { MissingAdminApiBaseUrlError } from "./firstOwnerOnboardingErrors";

export function formatOwnerLoginError(error: unknown): string {
  if (error instanceof OwnerLoginInvalidCredentialsError) {
    return "Could not sign in. Check your email and password and try again.";
  }
  if (error instanceof InvalidOwnerLoginInputError) {
    return error.message;
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
  return "Request failed. Check the API and try again.";
}
