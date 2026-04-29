<template>
  <div
    class="bg-background text-foreground flex min-h-dvh"
    data-testid="app-shell"
  >
    <aside
      aria-label="Meals navigation"
      class="border-sidebar-border bg-sidebar text-sidebar-foreground flex w-56 shrink-0 flex-col border-r"
    >
      <div class="border-sidebar-border border-b px-4 py-4">
        <p class="text-sidebar-foreground font-semibold tracking-tight">
          Healthy Meals
        </p>
        <p class="text-muted-foreground text-xs">
          Owner web
        </p>
      </div>

      <nav class="flex flex-1 flex-col gap-0.5 p-2" aria-label="Primary">
        <NuxtLink
          v-for="item in mealsNavDestinations"
          :key="item.path"
          :to="item.path"
          class="hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-md px-3 py-2 text-sm transition-colors"
          :class="navItemClass(item.path)"
          :data-testid="item.testid"
          :aria-current="isActivePath(item.path) ? 'page' : undefined"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="border-sidebar-border mt-auto border-t p-3">
        <p
          v-if="displayName"
          class="text-muted-foreground mb-3 truncate text-xs"
          data-testid="shell-current-user"
        >
          {{ displayName }}
        </p>
        <Button
          type="button"
          data-testid="logout-button"
          :disabled="isLoggingOut"
          variant="secondary"
          class="w-full"
          size="sm"
          @click="onLogout"
        >
          {{ isLoggingOut ? "Signing out…" : "Sign out" }}
        </Button>
        <div
          v-if="isLoggingOut"
          aria-live="polite"
          class="text-muted-foreground mt-2 text-xs"
          data-testid="logout-loading"
          role="status"
        >
          Ending session…
        </div>
      </div>
    </aside>

    <main class="min-w-0 flex-1 overflow-auto p-6 md:p-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useMutation } from "@pinia/colada";
import { storeToRefs } from "pinia";

import { Button } from "@/components/ui/button";
import { useHealthyApiStore } from "@/stores/healthyApi";
import { createHealthyApiClient } from "@/utils/healthyApiClient";
import { mealsNavDestinations } from "@/utils/mealsNavigation";
import { performHealthyApiLogoutBestEffort } from "@/utils/sessionEndedChoreography";

const route = useRoute();
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

function isActivePath(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`);
}

function navItemClass(path: string) {
  return isActivePath(path)
    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
    : "text-sidebar-foreground";
}

async function onLogout() {
  await mutateAsync();
}

onMounted(async () => {
  const resolved = api.value;
  if (!resolved.ok) return;
  try {
    apiStore.setCurrentUser(await createHealthyApiClient({ baseUrl: resolved.baseUrl }).getCurrentUser());
  } catch {
    // Middleware should keep unauthenticated users off shell routes; ignore probe failures here.
  }
});
</script>
