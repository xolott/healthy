import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["**/configuration-unreachable.e2e.ts"],
  forbidOnly: Boolean(process.env.CI),

  retries: process.env.CI ? 1 : 0,

  reporter: [["list"], ["html", { outputFolder: "playwright-report-unreachable", open: "never" }]],

  use: {
    baseURL: "http://127.0.0.1:3020",
    trace: "on-first-retry",
  },

  webServer: {
    command: "E2E_NUXT_PORT=3020 node ./tests/e2e/stack-nuxt-only.mjs",
    url: "http://127.0.0.1:3020/",
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
