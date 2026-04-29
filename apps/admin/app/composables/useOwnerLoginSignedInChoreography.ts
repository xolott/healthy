import { useQueryCache } from "@pinia/colada";

import { useHealthyApiStore } from "@/stores/healthyApi";
import { healthyAuthMeQueryKey, healthyPublicStatusQueryKey } from "@/utils/healthyApiQueryKeys";
import type { CurrentUser } from "@/utils/healthyApiAuth";
import { runOwnerSignedInChoreography } from "@/utils/ownerLoginSignedInChoreography";

/**
 * Wires {@link runOwnerSignedInChoreography} to Pinia Colada, the Healthy API store, runtime API base resolution, and Nuxt navigation.
 */
export function useOwnerLoginSignedInChoreography() {
  const api = useHealthyApiBaseUrl();
  const queryCache = useQueryCache();
  const apiStore = useHealthyApiStore();

  async function afterOwnerSignedIn(user: CurrentUser) {
    await runOwnerSignedInChoreography(user, api.value, {
      setCurrentUser: (u) => apiStore.setCurrentUser(u),
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
      navigateToHome: async (): Promise<void> => {
        await navigateTo("/home");
      },
    });
  }

  return { afterOwnerSignedIn };
}
