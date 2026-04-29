import { expect, test } from "@playwright/test";

const ownerPassword = "goodpassword12";

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

test.describe("Admin auth lifecycle (integrated)", () => {
  test("fresh API: onboarding handoff → login → home → logout (route guards + shell)", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByTestId("onboarding-submit").waitFor({ state: "visible" });

    await expect(page.locator("#onboarding-title")).toHaveText("Create owner account");

    const unique = `e2e-${String(Date.now())}@example.com`;
    await page.getByRole("textbox", { name: "Display name" }).fill("E2E Owner");
    await page.getByRole("textbox", { name: "Email" }).fill(unique);
    await page.getByRole("textbox", { name: "Password" }).fill(ownerPassword);
    await page.getByTestId("onboarding-submit").click();

    await expect(page).toHaveURL(/\/login/, { timeout: 60_000 });
    await expect(page.locator("#login-title")).toHaveText("Sign in");

    // After first-owner handoff choreography, /home should still see unauthenticated guard decisions.
    await page.goto("/home", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/login/, { timeout: 60_000 });
    await expect(page.locator("#login-title")).toHaveText("Sign in");

    await page.getByRole("textbox", { name: "Email" }).fill(unique);
    await page.getByRole("textbox", { name: "Password" }).fill(ownerPassword);
    await page.getByTestId("login-submit").click();

    await expect(page).toHaveURL(/\/home/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Healthy administration shell" })).toBeVisible();
    await expect(page.getByTestId("home-current-user")).toContainText("E2E Owner");

    await page.getByTestId("logout-button").click();
    await expect(page).toHaveURL(/\/login/, { timeout: 60_000 });
    await expect(page.locator("#login-title")).toHaveText("Sign in");

    // After session-ended choreography, deep-linking to /home should again land on sign-in.
    await page.goto("/home", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/login/, { timeout: 60_000 });
    await expect(page.locator("#login-title")).toHaveText("Sign in");
  });

  test("protected home: new browser context without session lands on sign-in", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/home");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#login-title")).toHaveText("Sign in");
    await context.close();
  });
});
