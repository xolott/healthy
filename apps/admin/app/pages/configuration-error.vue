<template>
  <div class="bg-background flex min-h-dvh flex-col items-center justify-center p-6">
    <Card class="w-full max-w-lg" aria-labelledby="configuration-error-title">
      <CardHeader>
        <CardTitle id="configuration-error-title">Healthy API configuration</CardTitle>
        <CardDescription>
          Configured API base URL (from deployment environment, not editable in this UI):
        </CardDescription>
        <p class="text-muted-foreground font-mono text-xs break-words">{{ rawConfiguredUrl }}</p>
      </CardHeader>
      <CardContent class="space-y-4">
        <Alert data-testid="configuration-error-alert" variant="destructive">
          <AlertTitle>{{ headline }}</AlertTitle>
          <AlertDescription>{{ detail }}</AlertDescription>
        </Alert>

        <div
          v-if="showLoading"
          aria-live="polite"
          data-testid="configuration-retry-loading"
          role="status"
          class="text-muted-foreground text-sm"
        >
          Checking connection…
        </div>

        <Button
          data-testid="configuration-retry"
          type="button"
          :disabled="showLoading"
          @click="onRetry"
        >
          Retry
        </Button>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { useQuery } from "@pinia/colada";

import { runConfigurationRetry } from "@/utils/healthyApiConfigurationRetry";
import type { ConfigurationErrorReason } from "@/utils/healthyApiGlobalRoute";
import { resolveConfiguredApiBaseUrl } from "@/utils/healthyApiConfig";
import { healthyPublicStatusQueryKey } from "@/utils/healthyApiQueryKeys";
import { fetchHealthyPublicStatus } from "@/utils/healthyApiStatus";
import { useHealthyApiStore } from "@/stores/healthyApi";

definePageMeta({
  layout: false,
});

const route = useRoute();
const config = useRuntimeConfig();
const apiStore = useHealthyApiStore();

const rawConfiguredUrl = computed(() => String(config.public.apiBaseUrl ?? ""));

const reason = computed<ConfigurationErrorReason>(() => {
  const q = route.query.reason;
  const s = (Array.isArray(q) ? q[0] : q) as string | undefined;
  if (s === "missing" || s === "invalid_url" || s === "unreachable") {
    return s;
  }
  return "unreachable";
});

const resolved = computed(() => resolveConfiguredApiBaseUrl(rawConfiguredUrl.value));

const baseUrlForProbe = computed(() => (resolved.value.ok ? resolved.value.baseUrl : ""));

const { refetch, isLoading } = useQuery({
  key: () => [...healthyPublicStatusQueryKey(baseUrlForProbe.value)],
  query: () => fetchHealthyPublicStatus(baseUrlForProbe.value),
  enabled: false,
});

const showLoading = computed(() => isLoading.value);

const headline = computed(() => {
  switch (reason.value) {
    case "missing":
      return "API base URL is not configured";
    case "invalid_url":
      return "API base URL is not valid";
    default:
      return "Cannot reach Healthy API";
  }
});

const detail = computed(() => {
  switch (reason.value) {
    case "missing":
      return "Set NUXT_PUBLIC_API_BASE_URL (or your host’s equivalent) to the Healthy API origin, redeploy, then retry.";
    case "invalid_url":
      return "The configured value must be a full http(s) URL (for example http://127.0.0.1:3001). Update the environment variable and redeploy.";
    default:
      return "The server did not return a valid response from /status. Confirm the process is running and reachable from this browser.";
  }
});

async function onRetry() {
  apiStore.markProbe();
  await runConfigurationRetry({
    reason: reason.value,
    resolved: resolved.value,
    refetchUnreachable: () => refetch(),
    reloadPage: () => {
      if (import.meta.client) {
        window.location.reload();
      }
    },
    navigateHome: async () => {
      await navigateTo("/");
    },
  });
}
</script>
