<template>
  <section aria-labelledby="login-title" style="max-width: 28rem">
    <h1 id="login-title" style="font-size: 1.5rem">Sign in</h1>
    <p style="margin-top: 0.85rem; max-width: 32rem; opacity: 0.9">
      Enter the owner email and password for this Healthy server. Passwords follow the same minimum length as
      first-owner setup ({{ passwordMinLength }} characters).
    </p>

    <p style="margin-top: 0.5rem; font-size: 0.9rem; opacity: 0.85" id="password-hint">
      Only active owner accounts can sign in here.
    </p>

    <div
      v-if="formError"
      role="alert"
      data-testid="login-error"
      style="margin-top: 1rem; padding: 0.75rem 1rem; border-radius: 8px; background: #3a1f1f"
    >
      {{ formError }}
    </div>

    <form style="margin-top: 1.1rem" @submit.prevent="onSubmit">
      <label for="email" style="display: block; font-size: 0.9rem; margin-bottom: 0.35rem">Email</label>
      <input
        id="email"
        v-model="email"
        type="email"
        name="email"
        required
        autocomplete="email"
        data-testid="login-email"
        style="width: 100%; padding: 0.5rem 0.65rem; border-radius: 6px; border: 1px solid #444"
      />

      <label
        for="password"
        style="display: block; font-size: 0.9rem; margin-top: 0.85rem; margin-bottom: 0.35rem"
        >Password</label
      >
      <input
        id="password"
        v-model="password"
        type="password"
        name="password"
        required
        :minlength="passwordMinLength"
        autocomplete="current-password"
        aria-describedby="password-hint"
        data-testid="login-password"
        style="width: 100%; padding: 0.5rem 0.65rem; border-radius: 6px; border: 1px solid #444"
      />

      <button
        type="submit"
        :disabled="submitting"
        data-testid="login-submit"
        style="margin-top: 1rem; padding: 0.45rem 1rem; border-radius: 6px; cursor: pointer"
      >
        Sign in
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";

import {
  InvalidOwnerLoginInputError,
  OwnerLoginInvalidCredentialsError,
  PASSWORD_MIN_LENGTH,
  postOwnerLogin,
} from "../utils/healthyApiAuth";

const email = ref("");
const password = ref("");
const formError = ref<string | null>(null);
const submitting = ref(false);

const passwordMinLength = PASSWORD_MIN_LENGTH;

const api = useHealthyApiBaseUrl();

async function onSubmit() {
  formError.value = null;
  if (!api.value.ok) {
    formError.value =
      "API base URL is missing or invalid. Configure NUXT_PUBLIC_API_BASE_URL for this deployment.";
    return;
  }
  const base = api.value.baseUrl;
  if (password.value.length < passwordMinLength) {
    formError.value = `Password must be at least ${String(passwordMinLength)} characters.`;
    return;
  }
  submitting.value = true;
  try {
    await postOwnerLogin(base, {
      email: email.value.trim(),
      password: password.value,
    });
    await navigateTo("/home");
  } catch (e) {
    if (e instanceof OwnerLoginInvalidCredentialsError) {
      formError.value = "Could not sign in. Check your email and password and try again.";
    } else if (e instanceof InvalidOwnerLoginInputError) {
      formError.value = e.message;
    } else {
      formError.value = "Request failed. Check the API and try again.";
    }
  } finally {
    submitting.value = false;
  }
}
</script>
