import { useQueryCache } from "@pinia/colada";

import { useHealthyApiStore } from "@/stores/healthyApi";
import { healthyAuthMeQueryKey, healthyPublicStatusQueryKey } from "@/utils/healthyApiQueryKeys";
import { createHealthyApiClient } from "@/utils/healthyApiClient";
import { runFirstOwnerCreatedChoreography } from "@/utils/firstOwnerCreatedChoreography";

/**
 * Wires {@link runFirstOwnerCreatedChoreography} to Pinia Colada, the Healthy API store, runtime API base resolution,
 * logout, and Nuxt navigation.
 */
export function useFirstOwnerCreatedChoreography() {
  const api = useHealthyApiBaseUrl();
  const queryCache = useQueryCache();
  const apiStore = useHealthyApiStore();

  async function afterFirstOwnerCreated() {
    await runFirstOwnerCreatedChoreography(api.value, async (baseUrl): Promise<void> => {
      await createHealthyApiClient({ baseUrl }).logout();
    }, {
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
      navigateToLogin: async (): Promise<void> => {
        await navigateTo("/login");
      },
    });
  }

  return { afterFirstOwnerCreated };
}
