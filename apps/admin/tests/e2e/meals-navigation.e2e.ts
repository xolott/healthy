import { expect, test } from "@playwright/test";

const ownerPassword = "goodpassword12";

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.describe("Meals navigation shell (integrated)", () => {
  test("sidebar reaches Home, Food Log, Pantry, and Progress placeholders", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByTestId("onboarding-submit").waitFor({ state: "visible" });

    const unique = `e2e-nav-${String(Date.now())}@example.com`;
    await page.getByRole("textbox", { name: "Display name" }).fill("E2E Nav Owner");
    await page.getByRole("textbox", { name: "Email" }).fill(unique);
    await page.getByRole("textbox", { name: "Password" }).fill(ownerPassword);
    await page.getByTestId("onboarding-submit").click();

    await expect(page).toHaveURL(/\/login/, { timeout: 60_000 });

    await page.getByRole("textbox", { name: "Email" }).fill(unique);
    await page.getByRole("textbox", { name: "Password" }).fill(ownerPassword);
    await page.getByTestId("login-submit").click();

    await expect(page).toHaveURL(/\/home/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
    await expect(page.getByTestId("meals-nav-home")).toHaveAttribute("aria-current", "page");

    await page.getByTestId("meals-nav-food-log").click();
    await expect(page).toHaveURL(/\/food-log/);
    await expect(page.getByRole("heading", { name: "Food Log" })).toBeVisible();
    await expect(page.getByTestId("meals-nav-food-log")).toHaveAttribute("aria-current", "page");

    await page.getByTestId("meals-nav-pantry").click();
    await expect(page).toHaveURL(/\/pantry/);
    await expect(page.getByRole("heading", { name: "Pantry" })).toBeVisible();
    await expect(page.getByTestId("pantry-catalog-health")).toBeVisible();
    await expect(page.getByTestId("pantry-empty")).toBeVisible();
    await expect(page.getByTestId("pantry-create-food-card")).toBeVisible();

    const foodLabel = `E2E Pantry Food ${Date.now()}`;
    await page.getByTestId("pantry-create-food-name").fill(foodLabel);
    await page.getByTestId("pantry-create-food-base-value").fill("50");
    await page.getByTestId("pantry-create-food-calories").fill("120");
    await page.getByTestId("pantry-create-food-protein").fill("4");
    await page.getByTestId("pantry-create-food-fat").fill("2");
    await page.getByTestId("pantry-create-food-carbs").fill("18");
    await page.getByTestId("pantry-create-food-submit").click();

    await expect(page.getByText(foodLabel)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("pantry-empty")).toHaveCount(0);

    await page.getByTestId("meals-nav-progress").click();
    await expect(page).toHaveURL(/\/progress/);
    await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();

    await page.getByTestId("meals-nav-home").click();
    await expect(page).toHaveURL(/\/home/);
  });
});
