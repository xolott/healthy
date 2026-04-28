<template>
  <section aria-labelledby="setup-title" style="max-width: 32rem">
    <h1 id="setup-title" style="font-size: 1.5rem">Connect to Healthy API</h1>
    <p style="margin-top: 0.75rem; opacity: 0.9">
      Enter the base URL of your Healthy API (no trailing path). It is checked with the public
      <code>/status</code> endpoint, then stored in this browser.
    </p>

    <div
      v-if="showReconnectBanner"
      role="alert"
      data-testid="connection-error"
      style="margin-top: 1rem; padding: 0.75rem 1rem; border-radius: 8px; background: #3a1f1f"
    >
      Could not reach a Healthy API at that URL. Fix the address or ensure the server is running,
      then try again.
    </div>

    <div
      v-if="validationFailed"
      role="alert"
      data-testid="validation-error"
      style="margin-top: 1rem; padding: 0.75rem 1rem; border-radius: 8px; background: #3a1f1f"
    >
      That URL did not return a valid Healthy <code>/status</code> payload. Check the address and
      try again.
    </div>

    <form style="margin-top: 1.25rem" @submit.prevent="onSubmit">
      <label for="api-url" style="display: block; font-size: 0.9rem; margin-bottom: 0.35rem"
        >API base URL</label
      >
      <input
        id="api-url"
        v-model="urlInput"
        type="url"
        required
        autocomplete="url"
        placeholder="http://127.0.0.1:3001"
        style="width: 100%; padding: 0.5rem 0.65rem; border-radius: 6px; border: 1px solid #444"
      />
      <button
        type="submit"
        style="margin-top: 1rem; padding: 0.45rem 1rem; border-radius: 6px; cursor: pointer"
      >
        Save and continue
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { fetchHealthyPublicStatus } from "../utils/healthyApiStatus";

const route = useRoute();
const config = useRuntimeConfig();

const urlInput = ref(
  (useCookie("healthy_api_base_url").value ?? config.public.apiBaseUrl ?? "").toString().trim(),
);

const validationFailed = ref(false);

const showReconnectBanner = computed(() => route.query.reconnect === "1");

async function onSubmit() {
  validationFailed.value = false;
  const trimmed = urlInput.value.trim().replace(/\/+$/, "");
  try {
    await fetchHealthyPublicStatus(trimmed);
  } catch {
    validationFailed.value = true;
    return;
  }
  const apiCookie = useCookie("healthy_api_base_url", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
  apiCookie.value = trimmed;
  await navigateTo({ path: "/", query: {} });
}
</script>
