import { test, expect, type TestInfo } from "@playwright/test";
import { expectBundleHasApiHost, expectDesktopChrome, expectMobileChrome } from "./helpers";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/documents/new", "/compare"] as const;

function projectIs(testInfo: TestInfo, name: string) {
  test.skip(testInfo.project.name !== name, `${name} only`);
}

test.describe("viewport — shared", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`loads ${route} without fatal error`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const res = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(res?.ok()).toBeTruthy();
      expect(errors.filter((e) => !e.includes("ResizeObserver"))).toHaveLength(0);
      await expect(page.locator("#root")).not.toBeEmpty();
    });
  }
});

test.describe("viewport — desktop web", () => {
  test.beforeEach(({ page: _page }, testInfo) => projectIs(testInfo, "desktop-chrome"));

  test("shows desktop header navigation", async ({ page }) => {
    await page.goto("/documents/new");
    await expectDesktopChrome(page);
  });

  test("editor uses desktop workspace (not mobile shell)", async ({ page }) => {
    await page.goto("/documents/new");
    await expect(page.locator(".jb-mobile-editor")).toHaveCount(0);
    await expect(page.locator(".jb-workspace")).toBeVisible();
  });

  test("compare uses desktop split layout", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.locator(".jb-mobile-compare")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Compare JSON" })).toBeVisible();
  });

  test("landing hero readable at desktop width", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /open editor|sign up free/i }).first()).toBeVisible();
  });

  test("API host embedded in production bundle", async ({ page }) => {
    await page.goto("/login");
    await expectBundleHasApiHost(page);
  });
});

test.describe("viewport — mobile web (mweb)", () => {
  test.beforeEach(({ page: _page }, testInfo) => projectIs(testInfo, "mobile-iphone"));

  test("shows bottom navigation + FAB", async ({ page }) => {
    await page.goto("/");
    await expectMobileChrome(page);
    await expect(page.getByRole("button", { name: /create/i })).toBeVisible();
  });

  test("hides desktop header bar on mobile", async ({ page }) => {
    await page.goto("/documents/new");
    await expect(page.locator("header.hidden.md\\:block")).toBeHidden();
    await expectMobileChrome(page);
  });

  test("editor uses mobile full-screen layout", async ({ page }) => {
    await page.goto("/documents/new");
    await expect(page.locator(".jb-mobile-editor")).toBeVisible();
    await expect(page.locator(".jb-workspace")).toHaveCount(0);
  });

  test("mobile toolbar chips visible", async ({ page }) => {
    await page.goto("/documents/new");
    await expect(page.getByRole("button", { name: "Format" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tree" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Issues/ })).toBeVisible();
  });

  test("compare uses mobile diff cards (not side-by-side)", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.locator(".jb-mobile-compare")).toBeVisible();
    await expect(page.getByRole("button", { name: "Version A" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Version B" })).toBeVisible();
  });

  test("search opens bottom sheet palette", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Primary" }).getByText("Search").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  });

  test("FAB menu opens create actions", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /create/i }).click();
    await expect(page.getByRole("button", { name: "New JSON" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Paste JSON" })).toBeVisible();
  });

  test("login page touch-friendly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    const box = await page.getByRole("button", { name: /sign in/i }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
  });
});

test.describe("viewport — tablet", () => {
  test.beforeEach(({ page: _page }, testInfo) => projectIs(testInfo, "tablet-ipad"));

  test("uses desktop chrome at tablet width (>=768)", async ({ page }) => {
    await page.goto("/documents/new");
    await expectDesktopChrome(page);
    await expect(page.locator(".jb-mobile-editor")).toHaveCount(0);
  });

  test("compare desktop layout on tablet", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.locator(".jb-mobile-compare")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Compare JSON" })).toBeVisible();
  });

  test("landing fits tablet without horizontal scroll", async ({ page }) => {
    await page.goto("/");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test("tablet editor workspace at >=768", async ({ page }) => {
    await page.goto("/documents/new");
    await expect(page.locator(".jb-workspace")).toBeVisible();
    await expect(page.locator(".jb-mobile-editor")).toHaveCount(0);
  });
});
