import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  typescript: {
    strict: true,
    /** Playwright stack sets `NUXT_DISABLE_TYPECHECK=1` to avoid vue-tsc copy flakiness in ephemeral environments. */
    typeCheck: process.env["NUXT_DISABLE_TYPECHECK"] !== "1",
  },
  css: ["~/assets/css/tailwind.css"],
  vite: {
    plugins: [tailwindcss()],
  },
  modules: ["@nuxt/eslint", "@pinia/nuxt", "@pinia/colada-nuxt", "shadcn-nuxt"],
  shadcn: {
    prefix: "",
    componentDir: "@/components/ui",
  },
  nitro: {
    routeRules: {
      "/api/health": { cors: true },
    },
  },
  runtimeConfig: {
    public: {
      /** Same hostname as the browser uses for admin (`localhost` vs `127.0.0.1` must match API URL or session cookies are not sent on HTTP — SameSite=Lax). */
      apiBaseUrl: "http://localhost:3001",
    },
  },
});
