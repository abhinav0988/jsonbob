import { expect, type Page } from "@playwright/test";

export async function expectToast(page: Page, text: string | RegExp, timeout = 8_000) {
  const toast = page.locator('[role="status"]').filter({ hasText: text });
  await expect(toast.first()).toBeVisible({ timeout });
}

export async function pasteInMonaco(page: Page, text: string, index = 0) {
  const editor = page.locator(".monaco-editor").nth(index);
  await editor.click({ timeout: 15_000 });
  await page.keyboard.press("Control+A");
  await page.evaluate(async (payload) => {
    await navigator.clipboard.writeText(payload);
  }, text);
  await page.keyboard.press("Control+V");
  await page.waitForTimeout(500);
}

export async function setComparePaneText(page: Page, pane: "A" | "B", text: string) {
  const title = pane === "A" ? "Document A" : "Document B";
  const section = page.locator("section").filter({ has: page.getByText(title, { exact: true }) });
  await section.getByRole("button", { name: "text", exact: true }).click();
  const index = pane === "A" ? 0 : 1;
  await pasteInMonaco(page, text, index);
}

export async function getDiffTotal(page: Page): Promise<number> {
  const box = page.locator("div.rounded-lg").filter({
    has: page.getByText("Total", { exact: true }),
  }).first();
  const raw = (await box.locator(".text-xl").textContent()) ?? "0";
  const n = parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

export async function expectDiffTotal(
  page: Page,
  expected: number | ((n: number) => boolean),
) {
  await expect(async () => {
    const total = await getDiffTotal(page);
    const ok = typeof expected === "function" ? expected(total) : total === expected;
    if (!ok) {
      throw new Error(
        typeof expected === "function"
          ? `Diff total ${total} failed predicate`
          : `Expected diff total ${expected}, got ${total}`,
      );
    }
  }).toPass({ timeout: 10_000 });
}

export async function transformPane(page: Page, pane: "A" | "B", action: string) {
  const title = pane === "A" ? "Document A" : "Document B";
  const section = page.locator("section").filter({ has: page.getByText(title, { exact: true }) });
  await section.getByRole("button", { name: /Transform/ }).click();
  await section.getByRole("button", { name: action, exact: true }).click();
}
