import { useQueryCache } from "@pinia/colada";

import { useHealthyApiStore } from "@/stores/healthyApi";
import { healthyAuthMeQueryKey, healthyPublicStatusQueryKey } from "@/utils/healthyApiQueryKeys";
import { runSessionEndedChoreography } from "@/utils/sessionEndedChoreography";

/**
 * Wires {@link runSessionEndedChoreography} to Pinia Colada, the Healthy API store, runtime API base resolution, and Nuxt navigation.
 */
export function useSessionEndedChoreography() {
  const api = useHealthyApiBaseUrl();
  const queryCache = useQueryCache();
  const apiStore = useHealthyApiStore();

  async function afterSessionEnded() {
    await runSessionEndedChoreography(api.value, {
      clearAuthenticatedShellState: () => apiStore.clearAuthenticatedState(),
      invalidatePublicStatusAndAuthMe: async (baseUrl) => {
        await queryCache.invalidateQueries({
          key: [...healthyPublicStatusQueryKey(baseUrl)],
          exact: true,
        });
        await queryCache.invalidateQueries({
          key: [...healthyAuthMeQueryKey(baseUrl)],
          exact: true,
        });
      },
      markProbe: () => apiStore.markProbe(),
      navigateAfterSessionEnded: async (): Promise<void> => {
        await navigateTo("/login");
      },
    });
  }

  return { afterSessionEnded };
}
