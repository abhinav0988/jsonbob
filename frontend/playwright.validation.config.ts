import { defineConfig, devices } from "@playwright/test";

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL || process.env.JSONBOB_WEB_URL || "http://127.0.0.1:4173";
const useLocalPreview = !process.env.PLAYWRIGHT_BASE_URL && !process.env.JSONBOB_WEB_URL;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "feature-validation.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report-validation" }]],
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
    headless: process.env.PLAYWRIGHT_HEADED !== "1",
    launchOptions: { slowMo: Number(process.env.PLAYWRIGHT_SLOW_MO ?? 200) },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "validation-desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
