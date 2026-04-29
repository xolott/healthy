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
import { useMutation } from "@pinia/colada";
import { storeToRefs } from "pinia";

import { Button } from "@/components/ui/button";
import { useHealthyApiStore } from "@/stores/healthyApi";
import { createHealthyApiClient } from "@/utils/healthyApiClient";
import { performHealthyApiLogoutBestEffort } from "@/utils/sessionEndedChoreography";

const api = useHealthyApiBaseUrl();
const apiStore = useHealthyApiStore();
const { afterSessionEnded } = useSessionEndedChoreography();
const { currentUser } = storeToRefs(apiStore);

const displayName = computed(() => currentUser.value?.displayName ?? "");

const { mutateAsync, isLoading } = useMutation({
  mutation: async () => {
    await performHealthyApiLogoutBestEffort(api.value, (baseUrl) =>
      createHealthyApiClient({ baseUrl }).logout(),
    );
  },
  async onSuccess() {
    await afterSessionEnded();
  },
});

const isLoggingOut = computed(() => isLoading.value);

onMounted(async () => {
  const resolved = api.value;
  if (!resolved.ok) return;
  try {
    apiStore.setCurrentUser(await createHealthyApiClient({ baseUrl: resolved.baseUrl }).getCurrentUser());
  } catch {
    // Middleware should keep unauthenticated users off /home; ignore probe failures here.
  }
});

async function onLogout() {
  await mutateAsync();
}
</script>
