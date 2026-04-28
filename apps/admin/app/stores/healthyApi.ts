import { ref } from "vue";
import { defineStore } from "pinia";

import type { CurrentUser } from "../utils/healthyApiAuth";

/**
 * Admin ↔ Healthy API coordination (bootstrap, session, current user for the shell).
 */
export const useHealthyApiStore = defineStore("healthyApi", () => {
  const lastProbeAt = ref<number | null>(null);
  /** Set after a successful owner login; cleared on logout. Not a source of truth for route guards (cookie + /auth/me is). */
  const currentUser = ref<CurrentUser | null>(null);

  function markProbe() {
    lastProbeAt.value = Date.now();
  }

  function setCurrentUser(user: CurrentUser) {
    currentUser.value = user;
  }

  function clearAuthenticatedState() {
    currentUser.value = null;
  }

  return {
    lastProbeAt,
    currentUser,
    markProbe,
    setCurrentUser,
    clearAuthenticatedState,
  };
});
