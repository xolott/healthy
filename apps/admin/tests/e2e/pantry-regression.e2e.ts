import { expect, test, type Page } from "@playwright/test";

const ownerPassword = "goodpassword12";

test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

async function signInFreshOwner(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByTestId("onboarding-submit").waitFor({ state: "visible" });

  const unique = `e2e-pantry-${String(Date.now())}@example.com`;
  await page.getByRole("textbox", { name: "Display name" }).fill("E2E Pantry Owner");
  await page.getByRole("textbox", { name: "Email" }).fill(unique);
  await page.getByRole("textbox", { name: "Password" }).fill(ownerPassword);
  await page.getByTestId("onboarding-submit").click();

  await expect(page).toHaveURL(/\/login/, { timeout: 60_000 });
  await page.getByRole("textbox", { name: "Email" }).fill(unique);
  await page.getByRole("textbox", { name: "Password" }).fill(ownerPassword);
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/home/, { timeout: 60_000 });
}

test.describe("Pantry regression (integrated #90)", () => {
  test("tabs, search, food/recipe create, nested preview, listing, and detail views", async ({ page }) => {
    await signInFreshOwner(page);

    await page.getByTestId("meals-nav-pantry").click();
    await expect(page).toHaveURL(/\/pantry/);
    await expect(page.getByRole("heading", { name: "Pantry" })).toBeVisible();
    await expect(page.getByTestId("pantry-catalog-health")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Foods" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("pantry-items-search")).toBeVisible();

    const foodLabel = `E2E Applesauce ${Date.now()}`;
    await page.getByTestId("pantry-create-food-name").fill(foodLabel);
    await page.getByTestId("pantry-create-food-base-value").fill("50");
    await page.getByTestId("pantry-create-food-calories").fill("120");
    await page.getByTestId("pantry-create-food-protein").fill("4");
    await page.getByTestId("pantry-create-food-fat").fill("2");
    await page.getByTestId("pantry-create-food-carbs").fill("18");
    await page.getByTestId("pantry-create-food-submit").click();
    await expect(page.getByText(foodLabel)).toBeVisible({ timeout: 60_000 });

    await page.getByTestId("pantry-items-search").fill("zzno-match");
    await expect(page.getByTestId("pantry-search-no-matches")).toBeVisible();
    await page.getByTestId("pantry-items-search").fill("");
    await expect(page.getByText(foodLabel)).toBeVisible();

    await page.getByTestId("pantry-tab-recipes").click();
    await expect(page.getByRole("tab", { name: "Recipes" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("pantry-create-recipe-card")).toBeVisible();

    const innerLabel = `E2E Inner ${Date.now()}`;
    await page.getByTestId("pantry-create-recipe-name").fill(innerLabel);
    await page.getByTestId("pantry-create-recipe-servings").fill("1");
    await page.getByTestId("pantry-create-recipe-submit").click();
    await expect(page.getByTestId("pantry-recipe-item-link").filter({ hasText: innerLabel })).toBeVisible({
      timeout: 60_000,
    });

    const outerLabel = `E2E Outer ${Date.now()}`;
    await page.getByTestId("pantry-create-recipe-name").fill(outerLabel);
    await page.getByTestId("pantry-create-recipe-servings").fill("1");
    const ingSelect = page.locator('select[id^="recipe-ing-item-"]').first();
    await ingSelect.selectOption({ label: `${innerLabel} (recipe)` });
    await expect(page.getByTestId("pantry-create-recipe-preview")).toContainText("120");
    await page.getByTestId("pantry-create-recipe-submit").click();
    await expect(page.getByTestId("pantry-recipe-item-link").filter({ hasText: outerLabel })).toBeVisible({
      timeout: 60_000,
    });

    await page.getByTestId("pantry-items-search").fill(outerLabel.slice(0, 12));
    await expect(page.getByTestId("pantry-recipe-item-link").filter({ hasText: outerLabel })).toBeVisible();
    await expect(page.getByTestId("pantry-recipe-item-link").filter({ hasText: innerLabel })).toHaveCount(0);

    await page.getByTestId("pantry-items-search").fill("");
    await expect(page.getByTestId("pantry-recipe-item-link").filter({ hasText: outerLabel })).toBeVisible();
    await Promise.all([
      page.waitForURL(/\/pantry\/recipe\//),
      page.getByTestId("pantry-recipe-item-link").filter({ hasText: outerLabel }).click(),
    ]);
    await expect(page.getByTestId("pantry-recipe-detail-totals")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("pantry-recipe-detail-totals")).toContainText("120");
    await expect(page.getByText("Nested recipe")).toBeVisible();
    await page.getByTestId("pantry-recipe-detail-back").click();
    await expect(page).toHaveURL(/\/pantry$/);

    await page.getByTestId("pantry-tab-food").click();
    await Promise.all([
      page.waitForURL(/\/pantry\/food\//),
      page.getByTestId("pantry-food-item-link").filter({ hasText: foodLabel }).click(),
    ]);
    await expect(page.getByTestId("pantry-food-detail-base-card")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("pantry-food-detail-base-card")).toContainText("120");
  });
});
