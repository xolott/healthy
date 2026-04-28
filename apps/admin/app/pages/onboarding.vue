<template>
  <section aria-labelledby="onboarding-title" style="max-width: 28rem">
    <h1 id="onboarding-title" style="font-size: 1.5rem">Create owner account</h1>
    <p style="margin-top: 0.85rem; max-width: 32rem; opacity: 0.9">
      This server has no active owner yet. Set the initial owner — you will be signed in for 30 days on this
      device (session cookie for the API host).
    </p>

    <p style="margin-top: 0.5rem; font-size: 0.9rem; opacity: 0.85" id="password-hint">
      Password: at least {{ passwordMinLength }} characters.
    </p>

    <div
      v-if="formError"
      role="alert"
      data-testid="onboarding-error"
      style="margin-top: 1rem; padding: 0.75rem 1rem; border-radius: 8px; background: #3a1f1f"
    >
      {{ formError }}
    </div>

    <form style="margin-top: 1.1rem" @submit.prevent="onSubmit">
      <label for="display-name" style="display: block; font-size: 0.9rem; margin-bottom: 0.35rem"
        >Display name</label
      >
      <input
        id="display-name"
        v-model="displayName"
        type="text"
        name="displayName"
        required
        autocomplete="name"
        data-testid="onboarding-display-name"
        style="width: 100%; padding: 0.5rem 0.65rem; border-radius: 6px; border: 1px solid #444"
      />

      <label
        for="email"
        style="display: block; font-size: 0.9rem; margin-top: 0.85rem; margin-bottom: 0.35rem"
        >Email</label
      >
      <input
        id="email"
        v-model="email"
        type="email"
        name="email"
        required
        autocomplete="email"
        data-testid="onboarding-email"
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
        autocomplete="new-password"
        aria-describedby="password-hint"
        data-testid="onboarding-password"
        style="width: 100%; padding: 0.5rem 0.65rem; border-radius: 6px; border: 1px solid #444"
      />

      <button
        type="submit"
        :disabled="submitting"
        data-testid="onboarding-submit"
        style="margin-top: 1rem; padding: 0.45rem 1rem; border-radius: 6px; cursor: pointer"
      >
        Create owner and sign in
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";

import {
  InvalidInputApiError,
  PasswordPolicyApiError,
  PASSWORD_MIN_LENGTH,
  postFirstOwnerSetup,
  SetupNotFoundError,
} from "../utils/healthyApiAuth";

const displayName = ref("");
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
    await postFirstOwnerSetup(base, {
      displayName: displayName.value,
      email: email.value,
      password: password.value,
    });
    await navigateTo("/home");
  } catch (e) {
    if (e instanceof PasswordPolicyApiError) {
      formError.value = e.message;
    } else if (e instanceof InvalidInputApiError) {
      formError.value = e.message;
    } else if (e instanceof SetupNotFoundError) {
      formError.value = "Setup is no longer available. Try signing in if the server is already configured.";
    } else {
      formError.value = "Request failed. Check the API and try again.";
    }
  } finally {
    submitting.value = false;
  }
}
</script>
