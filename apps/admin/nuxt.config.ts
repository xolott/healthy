export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  typescript: {
    strict: true,
    typeCheck: true,
  },
  modules: ["@nuxt/eslint"],
  nitro: {
    routeRules: {
      "/api/health": { cors: true },
    },
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: "http://127.0.0.1:3001",
    },
  },
});
