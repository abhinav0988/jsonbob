import { defineConfig, devices } from "@playwright/test";

/**
 * Sequential, single-tab frontend walkthrough.
 * - 1 worker, no parallel tests
 * - Slow motion so you can watch each step
 * - Desktop only (no triple viewport rerun)
 */
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || process.env.JSONBOB_WEB_URL || "http://127.0.0.1:4173";
const useLocalPreview = !process.env.PLAYWRIGHT_BASE_URL && !process.env.JSONBOB_WEB_URL;
const slowMo = Number(process.env.PLAYWRIGHT_SLOW_MO ?? 400);
const headed = process.env.PLAYWRIGHT_HEADED === "1" || process.env.PWHEADED === "1";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "sequential.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 900_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-sequential" }]],
  ...(useLocalPreview
    ? {
        webServer: {
          command: "npm run preview -- --port 4173 --strictPort",
          url: "http://127.0.0.1:4173",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
  use: {
    baseURL,
    headless: !headed,
    launchOptions: { slowMo },
    trace: "on",
    screenshot: "on",
    video: headed ? "on" : "retain-on-failure",
  },
  projects: [
    {
      name: "sequential-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});
