import { expect, type Page } from "@playwright/test";

export async function expectDesktopChrome(page: Page) {
  const desktopHeader = page.locator("header.hidden.md\\:block");
  await expect(desktopHeader.getByRole("link", { name: "Editor" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);
}

export async function expectMobileChrome(page: Page) {
  const mobileNav = page.getByRole("navigation", { name: "Primary" });
  await expect(mobileNav).toBeVisible({ timeout: 15_000 });
  await expect(mobileNav.getByText("Home")).toBeVisible();
  await expect(mobileNav.getByText("Documents")).toBeVisible();
  await expect(mobileNav.getByText("Search")).toBeVisible();
  await expect(mobileNav.getByText("Profile")).toBeVisible();
}

export async function expectBundleHasApiHost(page: Page) {
  const scripts = await page.locator('script[src*="/assets/"]').all();
  let found = false;
  for (const s of scripts) {
    const src = await s.getAttribute("src");
    if (!src) continue;
    const res = await page.request.get(src.startsWith("http") ? src : new URL(src, page.url()).toString());
    const js = await res.text();
    if (js.includes("jsonbob-api.blobforges.workers.dev") || js.includes("127.0.0.1:8787")) {
      found = true;
      break;
    }
  }
  expect(found).toBeTruthy();
}
