import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.JSONBOB_WEB_URL || "http://127.0.0.1:4173";
const useLocalPreview = !process.env.PLAYWRIGHT_BASE_URL && !process.env.JSONBOB_WEB_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  timeout: 45_000,
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
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "tablet-ipad",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 834, height: 1194 },
        isMobile: false,
        hasTouch: true,
      },
    },
    {
      name: "mobile-iphone",
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
