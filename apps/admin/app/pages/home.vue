<template>
  <section aria-labelledby="landing-title">
    <h1 id="landing-title" style="font-size: 1.6rem">
      Healthy administration shell
    </h1>

    <p style="margin-top: 1rem">
      This workspace is scaffolding for a shared Vue/Nuxt administration experience across
      <strong>Healthy Meals</strong> and <strong>Healthy Workouts</strong>.
    </p>

    <p style="margin-top: 1.5rem">
      <button type="button" data-testid="logout-button" style="padding: 0.45rem 1rem; border-radius: 6px; cursor: pointer" @click="onLogout">
        Sign out
      </button>
    </p>
  </section>
</template>

<script setup lang="ts">
import { postAuthLogout } from "../utils/healthyApiAuth";

const api = useHealthyApiBaseUrl();

async function onLogout() {
  if (!api.value.ok) {
    await navigateTo({ path: "/configuration-error", query: { reason: "missing" } });
    return;
  }
  const base = api.value.baseUrl;
  try {
    await postAuthLogout(base);
  } catch {
    // Still leave the shell: user can reconnect if the API is down.
  }
  await navigateTo("/login");
}
</script>
