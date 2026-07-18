import { test, expect, type TestInfo } from "@playwright/test";
import { expectDesktopChrome, expectMobileChrome } from "./helpers";

function onlyProject(testInfo: TestInfo, name: string) {
  test.skip(testInfo.project.name !== name, `${name} only`);
}

const uniqueEmail = () => `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@jsonbob.test`;

test.describe("browser E2E — desktop flows", () => {
  test.beforeEach(({ page: _page }, testInfo) => onlyProject(testInfo, "desktop-chrome"));

  test("landing → Open editor opens workspace", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /open editor/i }).first().click();
    await expect(page).toHaveURL(/\/documents\/new/);
    await expect(page.locator(".jb-workspace")).toBeVisible({ timeout: 15_000 });
    await expectDesktopChrome(page);
  });

  test("landing → View demo opens compare with diffs", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /view demo/i }).first().click();
    await expect(page).toHaveURL(/\/compare/);
    await expect(page.getByRole("heading", { name: "Compare JSON" })).toBeVisible();
    await expect(page.getByText(/Total/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("guest editor: Format button runs on sample JSON", async ({ page }) => {
    await page.goto("/documents/new");
    await expect(page.locator(".jb-workspace")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Format/i }).first().click();
    await expect(page.locator(".jb-workspace")).toBeVisible();
  });

  test("guest editor: Tree panel opens", async ({ page }) => {
    await page.goto("/documents/new");
    await expect(page.locator(".jb-workspace")).toBeVisible({ timeout: 15_000 });

    const tree = page.getByRole("button", { name: /^Tree$/i }).or(page.getByTitle("Tree")).first();
    await tree.click();
    await expect(page.getByPlaceholder(/Search nodes/i)).toBeVisible({ timeout: 10_000 });
  });

  test("guest editor: Clear then Save publishes empty object", async ({ page }) => {
    await page.goto("/documents/new");
    await expect(page.locator(".jb-workspace")).toBeVisible({ timeout: 15_000 });

    // Clear sets valid `{\n  \n}` → Save as anonymous raw blob
    await page.getByRole("button", { name: "Clear" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/view\/[A-Za-z0-9_-]+/, { timeout: 25_000 });
  });

  test("guest editor: Problems panel opens", async ({ page }) => {
    await page.goto("/documents/new");
    await expect(page.locator(".jb-workspace")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Problems" }).click();
    await expect(page.getByText(/problem|no issues|error|warning/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("guest editor: Save publishes public /view/:id", async ({ page }) => {
    await page.goto("/documents/new");
    await expect(page.locator(".jb-workspace")).toBeVisible({ timeout: 15_000 });

    // Default sample JSON is valid — Save as anonymous raw blob → /view/:id
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/view\/[A-Za-z0-9_-]+/, { timeout: 25_000 });
    await expect(page.locator("#root")).not.toBeEmpty();
  });

  test("compare: Swap A/B keeps page usable", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.getByRole("heading", { name: "Compare JSON" })).toBeVisible();
    await page.getByRole("button", { name: "Swap A/B" }).click();
    await expect(page.getByRole("heading", { name: "Compare JSON" })).toBeVisible();
    await expect(page.getByText(/Document A|Version A/i).first()).toBeVisible();
  });

  test("compare: Format both runs", async ({ page }) => {
    await page.goto("/compare");
    await page.getByRole("button", { name: "Format both" }).click();
    await expect(page.getByRole("heading", { name: "Compare JSON" })).toBeVisible();
  });

  test("compare: next/prev difference navigation", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.getByRole("heading", { name: "Compare JSON" })).toBeVisible();

    const next = page.getByTitle("Next difference");
    if (await next.count()) {
      await next.click();
      await expect(page.getByRole("heading", { name: "Compare JSON" })).toBeVisible();
    }
    const prev = page.getByTitle("Previous difference");
    if (await prev.count()) {
      await prev.click();
    }
  });

  test("protected /dashboard redirects guest to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("login form validates empty submit", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("register → dashboard with unique account", async ({ page }) => {
    const email = uniqueEmail();
    const password = "TestPass123!";

    await page.goto("/register");
    await page.getByLabel(/^name$/i).fill("E2E Browser");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 25_000 });
    await expect(page.getByRole("link", { name: /logout|settings|documents/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("command palette opens and navigates to Compare", async ({ page }) => {
    await page.goto("/documents/new");
    await expect(page.locator(".jb-workspace")).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "⌘K" }).click();
    const input = page.getByPlaceholder(/Search commands, documents, or JSON paths/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("Open Compare");
    await page.getByRole("option", { name: /Open Compare/i }).or(page.getByText("Open Compare")).first().click();
    await expect(page).toHaveURL(/\/compare/, { timeout: 15_000 });
  });

  test("header nav: Compare and API links", async ({ page }) => {
    await page.goto("/documents/new");
    await expectDesktopChrome(page);
    await page.locator("header.hidden.md\\:block").getByRole("link", { name: "Compare" }).click();
    await expect(page).toHaveURL(/\/compare/);
    await page.locator("header.hidden.md\\:block").getByRole("link", { name: "API" }).click();
    await expect(page).toHaveURL(/\/api-playground/);
  });

  test("API playground page loads interactive UI", async ({ page }) => {
    await page.goto("/api-playground");
    await expect(page.locator("#root")).not.toBeEmpty();
    await expect(page.getByText(/API|playground|request/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("browser E2E — mobile flows", () => {
  test.beforeEach(({ page: _page }, testInfo) => onlyProject(testInfo, "mobile-iphone"));

  test("FAB → New JSON opens mobile editor", async ({ page }) => {
    await page.goto("/");
    await expectMobileChrome(page);
    await page.getByRole("button", { name: /create/i }).click();
    await page.getByRole("button", { name: "New JSON" }).click();
    await expect(page).toHaveURL(/\/documents\/new/);
    await expect(page.locator(".jb-mobile-editor")).toBeVisible({ timeout: 15_000 });
  });

  test("mobile editor Format chip works", async ({ page }) => {
    await page.goto("/documents/new");
    await expect(page.locator(".jb-mobile-editor")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Format" }).click();
    await expect(page.locator(".jb-mobile-editor")).toBeVisible();
  });

  test("mobile compare Version A/B tabs", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.locator(".jb-mobile-compare")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Version B" }).click();
    await page.getByRole("button", { name: "Version A" }).click();
    await expect(page.getByRole("button", { name: "Version A" })).toBeVisible();
  });

  test("search sheet opens from bottom nav", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Primary" }).getByText("Search").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test("Profile tab routes guest to login/profile", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Primary" }).getByText("Profile").click();
    await expect(page).toHaveURL(/\/(login|settings|profile)/, { timeout: 15_000 });
  });
});
