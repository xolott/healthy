import { expect, test } from "@playwright/test";

test.describe("Configured API unreachable (integrated)", () => {
  test("startup redirects to configuration error; retry refetches and stays on error when API stays down", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/configuration-error/);
    await expect(page.locator("#configuration-error-title")).toHaveText("Healthy API configuration");
    await expect(page.getByRole("alert")).toContainText("Cannot reach Healthy API");

    await page.getByRole("button", { name: "Retry" }).click();
    await expect(page.locator("#configuration-error-title")).toHaveText("Healthy API configuration", {
      timeout: 30_000,
    });
    await expect(page.getByRole("alert")).toContainText("Cannot reach Healthy API");
    await expect(page.getByRole("alert")).toContainText("Cannot reach Healthy API");
  });
});
