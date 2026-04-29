import type { ConfiguredApiResolution } from "./healthyApiConfig";

/**
 * Injectable side effects for the admin owner session-ended path (post-logout-request coordination).
 * Keeps ordering explicit: shell clear → optional cache invalidation → probe → navigation to login.
 */
export type SessionEndedChoreographyDeps = {
  clearAuthenticatedShellState(): void;
  invalidatePublicStatusAndAuthMe(apiBaseUrl: string): Promise<void>;
  markProbe(): void;
  navigateAfterSessionEnded(): Promise<void>;
};

/**
 * Calls the logout endpoint when {@link apiResolution} is usable; absorbs failures so local session-end choreography still runs.
 */
export async function performHealthyApiLogoutBestEffort(
  apiResolution: ConfiguredApiResolution,
  logout: (baseUrl: string) => Promise<void>,
): Promise<void> {
  if (!apiResolution.ok) return;
  try {
    await logout(apiResolution.baseUrl);
  } catch {
    // Session still ends locally; post-session choreography clears shell and navigates.
  }
}

/**
 * Runs the session-ended choreography: clear shell user, optional query invalidation when API base is usable,
 * probe timestamp, then navigation to login.
 */
export async function runSessionEndedChoreography(
  apiResolution: ConfiguredApiResolution,
  deps: SessionEndedChoreographyDeps,
): Promise<void> {
  deps.clearAuthenticatedShellState();
  if (apiResolution.ok) {
    await deps.invalidatePublicStatusAndAuthMe(apiResolution.baseUrl);
  }
  deps.markProbe();
  await deps.navigateAfterSessionEnded();
}
