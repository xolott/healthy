<template>
  <section aria-labelledby="landing-title">
    <h1 id="landing-title" style="font-size: 1.6rem">
      Healthy administration shell
    </h1>

    <p style="margin-top: 1rem">
      This workspace is scaffolding for a shared Vue/Nuxt administration experience across
      <strong>Healthy Meals</strong> and <strong>Healthy Workouts</strong>.
    </p>

    <p style="margin-top: 0.85rem">
      API base URL (public runtime config preview):
      <code>{{ apiBase }}</code>
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

const config = useRuntimeConfig();

const apiBase = computed(() => config.public.apiBaseUrl);
</script>
