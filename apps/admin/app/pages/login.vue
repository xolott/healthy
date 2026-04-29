<template>
  <div class="flex min-h-[50dvh] flex-col justify-center">
    <Card class="mx-auto w-full max-w-lg" aria-labelledby="login-title">
      <CardHeader>
        <CardTitle id="login-title">Sign in</CardTitle>
        <CardDescription>
          Enter the owner email and password for this Healthy server. Passwords follow the same minimum length as
          first-owner setup ({{ passwordMinLength }} characters).
        </CardDescription>
        <p id="password-hint" class="text-muted-foreground text-sm">Only active owner accounts can sign in here.</p>
      </CardHeader>
      <CardContent class="space-y-4">
        <Alert v-if="formError" data-testid="login-error" variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <div
          v-if="isSubmitting"
          aria-live="polite"
          class="text-muted-foreground text-sm"
          data-testid="login-loading"
          role="status"
        >
          Signing in…
        </div>

        <form class="space-y-4" method="post" action="#" @submit.prevent="onSubmit">
          <div class="space-y-2">
            <Label for="login-email">Email</Label>
            <Input
              id="login-email"
              v-model="email"
              type="email"
              name="email"
              required
              autocomplete="email"
              data-testid="login-email"
            />
          </div>

          <div class="space-y-2">
            <Label for="login-password">Password</Label>
            <Input
              id="login-password"
              v-model="password"
              type="password"
              name="password"
              required
              :minlength="passwordMinLength"
              autocomplete="current-password"
              aria-describedby="password-hint"
              data-testid="login-password"
            />
          </div>

          <Button
            type="submit"
            :disabled="isSubmitting"
            class="w-full sm:w-auto"
            data-testid="login-submit"
          >
            Sign in
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { useMutation, useQueryCache } from "@pinia/colada";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHealthyApiStore } from "@/stores/healthyApi";
import { MissingAdminApiBaseUrlError, clientPasswordTooShortMessage } from "@/utils/firstOwnerOnboardingErrors";
import { healthyAuthMeQueryKey, healthyPublicStatusQueryKey } from "@/utils/healthyApiQueryKeys";
import { formatOwnerLoginError } from "@/utils/ownerLoginErrors";
import { PASSWORD_MIN_LENGTH } from "@/utils/healthyApiAuth";
import { createHealthyApiClient } from "@/utils/healthyApiClient";

const email = ref("");
const password = ref("");
const formError = ref<string | null>(null);

const passwordMinLength = PASSWORD_MIN_LENGTH;

const api = useHealthyApiBaseUrl();
const queryCache = useQueryCache();
const apiStore = useHealthyApiStore();

const { mutateAsync, isLoading } = useMutation({
  mutation: async (input: { email: string; password: string }) => {
    const resolved = api.value;
    if (!resolved.ok) {
      throw new MissingAdminApiBaseUrlError();
    }
    return createHealthyApiClient({ baseUrl: resolved.baseUrl }).ownerLogin(input);
  },
  async onSuccess(user) {
    apiStore.setCurrentUser(user);
    const resolved = api.value;
    if (resolved.ok) {
      await queryCache.invalidateQueries({
        key: [...healthyPublicStatusQueryKey(resolved.baseUrl)],
        exact: true,
      });
      await queryCache.invalidateQueries({
        key: [...healthyAuthMeQueryKey(resolved.baseUrl)],
        exact: true,
      });
    }
    apiStore.markProbe();
    await navigateTo("/home");
  },
});

const isSubmitting = computed(() => isLoading.value);

async function onSubmit() {
  formError.value = null;
  if (!api.value.ok) {
    formError.value = formatOwnerLoginError(new MissingAdminApiBaseUrlError());
    return;
  }
  if (password.value.length < passwordMinLength) {
    formError.value = clientPasswordTooShortMessage(passwordMinLength);
    return;
  }
  try {
    await mutateAsync({
      email: email.value.trim(),
      password: password.value,
    });
  } catch (e) {
    formError.value = formatOwnerLoginError(e);
  }
}
</script>
