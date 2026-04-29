import type { HealthyAuthMeUser } from "./healthyApiClient";

export const PASSWORD_MIN_LENGTH = 12;

/** Current admin user (`/auth/me` success body). Roles match documented API enums. */
export type CurrentUser = HealthyAuthMeUser;
