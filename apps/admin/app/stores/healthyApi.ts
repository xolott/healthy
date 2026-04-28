import { ref } from "vue";
import { defineStore } from "pinia";

/**
 * Reserved store for admin ↔ Healthy API UI coordination (session/bootstrap flow).
 * Extended as features land; keeps Pinia wired for issue #18 acceptance.
 */
export const useHealthyApiStore = defineStore("healthyApi", () => {
  const lastProbeAt = ref<number | null>(null);

  function markProbe() {
    lastProbeAt.value = Date.now();
  }

  return { lastProbeAt, markProbe };
});
