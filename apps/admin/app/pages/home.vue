<template>
  <section aria-labelledby="landing-title">
    <h1 id="landing-title" style="font-size: 1.6rem">
      Healthy administration shell
    </h1>

    <p v-if="displayName" class="mt-4 text-muted-foreground text-sm" data-testid="home-current-user">
      Signed in as {{ displayName }}
    </p>

    <p style="margin-top: 1.5rem">
      <Button
        type="button"
        data-testid="logout-button"
        :disabled="isLoggingOut"
        variant="secondary"
        @click="onLogout"
      >
        {{ isLoggingOut ? "Signing out…" : "Sign out" }}
      </Button>
    </p>

    <div
      v-if="isLoggingOut"
      aria-live="polite"
      class="text-muted-foreground mt-2 text-sm"
      data-testid="logout-loading"
      role="status"
    >
      Ending session…
    </div>
  </section>
</template>

<script setup lang="ts">
import { useMutation, useQueryCache } from "@pinia/colada";
import { storeToRefs } from "pinia";

import { Button } from "@/components/ui/button";
import { useHealthyApiStore } from "@/stores/healthyApi";
import { MissingAdminApiBaseUrlError } from "@/utils/firstOwnerOnboardingErrors";
import { healthyAuthMeQueryKey, healthyPublicStatusQueryKey } from "@/utils/healthyApiQueryKeys";
import { fetchAuthMe, postAuthLogout } from "@/utils/healthyApiAuth";

const api = useHealthyApiBaseUrl();
const queryCache = useQueryCache();
const apiStore = useHealthyApiStore();
const { currentUser } = storeToRefs(apiStore);

const displayName = computed(() => currentUser.value?.displayName ?? "");

const { mutateAsync, isLoading } = useMutation({
  mutation: async () => {
    const resolved = api.value;
    if (!resolved.ok) {
      throw new MissingAdminApiBaseUrlError();
    }
    const base = resolved.baseUrl;
    try {
      await postAuthLogout(base);
    } catch {
      // Still clear local shell state if the API is unreachable.
    }
  },
  async onSuccess() {
    apiStore.clearAuthenticatedState();
    const resolved = api.value;
    if (resolved.ok) {
      await queryCache.invalidateQueries({
        key: [...healthyPublicStatusQueryKey(resolved.baseUrl)],
        exact: true,
      });
      await queryCache.invalidateQueries({
        key: [...healthyAuthMeQueryKey(resolved.baseUrl)],
        exact: true,
      });
    }
    apiStore.markProbe();
    await navigateTo("/login");
  },
});

const isLoggingOut = computed(() => isLoading.value);

onMounted(async () => {
  const resolved = api.value;
  if (!resolved.ok) return;
  try {
    apiStore.setCurrentUser(await fetchAuthMe(resolved.baseUrl));
  } catch {
    // Middleware should keep unauthenticated users off /home; ignore probe failures here.
  }
});

async function onLogout() {
  if (!api.value.ok) {
    await navigateTo({ path: "/configuration-error", query: { reason: "missing" } });
    return;
  }
  await mutateAsync();
}
</script>
