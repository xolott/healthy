import { expect, test } from "@playwright/test";

/**
 * Deep-link to configuration-error with invalid_url reason on a stack where the
 * deployment URL is actually valid — exercises reload-based retry (operator must
 * fix env and redeploy).
 */
test.describe("Configuration error page (deep link)", () => {
  test("invalid_url reason shows operator guidance; retry triggers reload", async ({ page }) => {
    await page.goto("/configuration-error?reason=invalid_url");
    await expect(page.locator("#configuration-error-title")).toHaveText("Healthy API configuration");
    await expect(page.getByRole("alert")).toContainText("API base URL is not valid");

    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.locator("#configuration-error-title")).toHaveText("Healthy API configuration", {
      timeout: 30_000,
    });
  });
});
