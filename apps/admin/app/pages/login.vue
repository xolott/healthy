<template>
  <section aria-labelledby="login-title">
    <h1 id="login-title" style="font-size: 1.5rem">Sign in</h1>
    <p style="margin-top: 0.85rem; max-width: 32rem; opacity: 0.9">
      Enter your email and password for this Healthy server. Passwords must be at least
      {{ passwordMinLength }} characters (same rule as first-owner setup).
    </p>
    <p style="margin-top: 0.75rem; max-width: 32rem; opacity: 0.85">
      Email and password login against the API is not wired yet; use first-owner onboarding on a fresh server,
      or restore an existing session via the API cookie.
    </p>
  </section>
</template>

<script setup lang="ts">
import { PASSWORD_MIN_LENGTH } from "../utils/healthyApiAuth";

const passwordMinLength = PASSWORD_MIN_LENGTH;
</script>
