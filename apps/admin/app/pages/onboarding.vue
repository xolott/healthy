<template>
  <div class="flex min-h-[50dvh] flex-col justify-center">
    <Card class="mx-auto w-full max-w-lg" aria-labelledby="onboarding-title">
      <CardHeader>
        <CardTitle id="onboarding-title">Create owner account</CardTitle>
        <CardDescription>
          This server has no active owner yet. Set the initial owner. After creation you will continue to sign
          in (new session cookies are cleared so you authenticate on the login page).
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <p id="password-hint" class="text-muted-foreground text-sm">Password: at least {{ passwordMinLength }} characters.</p>

        <Alert v-if="formError" data-testid="onboarding-error" variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <div
          v-if="isSubmitting"
          aria-live="polite"
          class="text-muted-foreground text-sm"
          data-testid="onboarding-loading"
          role="status"
        >
          Creating account…
        </div>

        <form class="space-y-4" method="post" action="#" @submit.prevent="onSubmit">
          <div class="space-y-2">
            <Label for="display-name">Display name</Label>
            <Input
              id="display-name"
              v-model="displayName"
              type="text"
              name="displayName"
              required
              autocomplete="name"
              data-testid="onboarding-display-name"
            />
          </div>

          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              name="email"
              required
              autocomplete="email"
              data-testid="onboarding-email"
            />
          </div>

          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input
              id="password"
              v-model="password"
              type="password"
              name="password"
              required
              :minlength="passwordMinLength"
              autocomplete="new-password"
              aria-describedby="password-hint"
              data-testid="onboarding-password"
            />
          </div>

          <Button
            type="submit"
            :disabled="isSubmitting"
            class="w-full sm:w-auto"
            data-testid="onboarding-submit"
          >
            Create owner account
          </Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>

<script setup lang="ts">
import { useMutation } from "@pinia/colada";

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
import {
  clientPasswordTooShortMessage,
  formatFirstOwnerOnboardingError,
  MissingAdminApiBaseUrlError,
} from "@/utils/firstOwnerOnboardingErrors";
import { PASSWORD_MIN_LENGTH } from "@/utils/healthyApiAuth";
import { createHealthyApiClient } from "@/utils/healthyApiClient";

const displayName = ref("");
const email = ref("");
const password = ref("");
const formError = ref<string | null>(null);

const passwordMinLength = PASSWORD_MIN_LENGTH;

const api = useHealthyApiBaseUrl();
const { afterFirstOwnerCreated } = useFirstOwnerCreatedChoreography();

const { mutateAsync, isLoading } = useMutation({
  mutation: async (input: { displayName: string; email: string; password: string }) => {
    const resolved = api.value;
    if (!resolved.ok) {
      throw new MissingAdminApiBaseUrlError();
    }
    return createHealthyApiClient({ baseUrl: resolved.baseUrl }).firstOwnerSetup(input);
  },
  async onSuccess() {
    await afterFirstOwnerCreated();
  },
});

const isSubmitting = computed(() => isLoading.value);

async function onSubmit() {
  formError.value = null;
  if (!api.value.ok) {
    formError.value = formatFirstOwnerOnboardingError(new MissingAdminApiBaseUrlError());
    return;
  }
  if (password.value.length < passwordMinLength) {
    formError.value = clientPasswordTooShortMessage(passwordMinLength);
    return;
  }
  try {
    await mutateAsync({
      displayName: displayName.value.trim(),
      email: email.value.trim(),
      password: password.value,
    });
  } catch (e) {
    formError.value = formatFirstOwnerOnboardingError(e);
  }
}
</script>
