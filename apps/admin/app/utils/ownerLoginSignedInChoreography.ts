import type { CurrentUser } from "./healthyApiAuth";
import type { ConfiguredApiResolution } from "./healthyApiConfig";

/**
 * Injectable side effects for the admin owner-login success path (post-mutation coordination).
 * Keeps ordering explicit: user → optional cache invalidation → probe → navigation.
 */
export type OwnerSignedInChoreographyDeps = {
  setCurrentUser(user: CurrentUser): void;
  invalidatePublicStatusAndAuthMe(apiBaseUrl: string): Promise<void>;
  markProbe(): void;
  navigateToHome(): Promise<void>;
};

/**
 * Runs the owner-signed-in choreography: shell user, optional query invalidation when API base is usable,
 * probe timestamp, then navigation to home.
 */
export async function runOwnerSignedInChoreography(
  user: CurrentUser,
  apiResolution: ConfiguredApiResolution,
  deps: OwnerSignedInChoreographyDeps,
): Promise<void> {
  deps.setCurrentUser(user);
  if (apiResolution.ok) {
    await deps.invalidatePublicStatusAndAuthMe(apiResolution.baseUrl);
  }
  deps.markProbe();
  await deps.navigateToHome();
}
