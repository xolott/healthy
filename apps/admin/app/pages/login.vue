<template>
  <section aria-labelledby="login-title">
    <h1 id="login-title" style="font-size: 1.5rem">Sign in</h1>
    <p style="margin-top: 0.85rem; max-width: 32rem; opacity: 0.9">
      Authentication is not wired yet. Continue to open the administration shell after the server
      reports setup is complete.
    </p>
    <button
      type="button"
      style="margin-top: 1.1rem; padding: 0.45rem 1rem; border-radius: 6px; cursor: pointer"
      @click="continueToApp"
    >
      Continue to app
    </button>
  </section>
</template>

<script setup lang="ts">
function continueToApp() {
  const session = useCookie("healthy_admin_session", {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
  });
  session.value = "1";
  return navigateTo("/");
}
</script>
