import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  typescript: {
    strict: true,
    typeCheck: true,
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
      apiBaseUrl: "http://127.0.0.1:3001",
    },
  },
});
