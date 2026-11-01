import { expect, type Page } from "@playwright/test";

/** Pause between steps so you can watch in headed mode (ms). */
export const STEP_PAUSE = Number(process.env.PLAYWRIGHT_STEP_MS ?? 600);

export async function step(page: Page, id: string, title: string, action: () => Promise<void>) {
  console.log(`\n── ${id} ${title}`);
  await action();
  await page.waitForTimeout(STEP_PAUSE);
}

export function attachConsoleMonitor(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return {
    assertClean() {
      const ignorable = (e: string) =>
        e.includes("ResizeObserver") ||
        /Failed to load resource:.*\b(401|404)\b/.test(e);
      const fatal = errors.filter((e) => !ignorable(e));
      expect(fatal, `Console errors: ${fatal.join("; ")}`).toHaveLength(0);
    },
  };
}

export const uniqueEmail = () =>
  `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@jsonbob.test`;
