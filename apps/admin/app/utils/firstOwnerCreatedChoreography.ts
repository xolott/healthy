import type { ConfiguredApiResolution } from "./healthyApiConfig";
import { performHealthyApiLogoutBestEffort } from "./sessionEndedChoreography";

/**
 * Injectable side effects for successful first-owner setup (setup-created-session handoff to login).
 * Ordering: clear shell → best-effort logout → optional cache invalidation when API base is usable → probe → navigate to login.
 */
export type FirstOwnerCreatedChoreographyDeps = {
  clearAuthenticatedShellState(): void;
  invalidatePublicStatusAndAuthMe(apiBaseUrl: string): Promise<void>;
  markProbe(): void;
  navigateToLogin(): Promise<void>;
};

/**
 * After first-owner bootstrap completes, clears local shell state, ends the setup session server-side best-effort,
 * refreshes cached public/session queries when configured, probes, then routes to `/login`.
 */
export async function runFirstOwnerCreatedChoreography(
  apiResolution: ConfiguredApiResolution,
  logout: (baseUrl: string) => Promise<void>,
  deps: FirstOwnerCreatedChoreographyDeps,
): Promise<void> {
  deps.clearAuthenticatedShellState();
  await performHealthyApiLogoutBestEffort(apiResolution, logout);
  if (apiResolution.ok) {
    await deps.invalidatePublicStatusAndAuthMe(apiResolution.baseUrl);
  }
  deps.markProbe();
  await deps.navigateToLogin();
}
