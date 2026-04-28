<template>
  <div class="flex min-h-dvh flex-col items-center justify-center p-6">
    <p role="status" aria-busy="true" data-testid="startup-gate">
      Checking API and session…
    </p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
});
</script>
