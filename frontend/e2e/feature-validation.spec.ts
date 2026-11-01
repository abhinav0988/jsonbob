import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { expectDesktopChrome } from "./helpers";
import { FeatureReport, testData } from "./helpers/featureReport";
import {
  expectDiffTotal,
  expectToast,
  pasteInMonaco,
  setComparePaneText,
  transformPane,
} from "./helpers/validationHelpers";

const report = new FeatureReport();
const reportPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/QA-FEATURE-REPORT.md",
);

test.describe.configure({ mode: "serial" });

test.afterAll(() => {
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL || process.env.JSONBOB_WEB_URL || "http://127.0.0.1:4173";
  report.writeMarkdown(reportPath, { baseURL });
});

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("Per-feature validation (valid + invalid data)", async ({ page }) => {
  const validEmail = testData.email();
  const validPassword = testData.password.valid;
  let publicViewUrl = "";

  // ── 1. Landing ───────────────────────────────────────────────────────
  await report.check("Landing", "FV-L01", "Home page loads with hero", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /JSON IDE for the edge/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  await report.check("Landing", "FV-L02", "Open editor CTA navigates to /documents/new", async () => {
    await page.getByRole("link", { name: /open editor/i }).first().click();
    await expect(page).toHaveURL(/\/documents\/new/, { timeout: 15_000 });
  });

  // ── 2. Guest JSON Editor ─────────────────────────────────────────────
  await report.check("Guest Editor", "FV-E01", "Workspace shell visible", async () => {
    await expect(page.locator(".jb-workspace")).toBeVisible({ timeout: 15_000 });
    await expectDesktopChrome(page);
  });

  await report.check("Guest Editor", "FV-E02", "Valid JSON: Format succeeds", async () => {
    await page.getByRole("button", { name: "Clear" }).click();
    await page.getByRole("button", { name: /Format/i }).first().click();
    await expect(page.getByText("Valid JSON")).toBeVisible({ timeout: 8_000 });
  });

  await report.check("Guest Editor", "FV-E03", "Valid JSON: Save creates public view", async () => {
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/view\/[A-Za-z0-9_-]+/, { timeout: 25_000 });
    publicViewUrl = page.url();
  });

  await report.check("Guest Editor", "FV-E04", "Invalid JSON: Save blocked with error", async () => {
    await page.goto("/documents/new");
    await expect(page.locator(".jb-workspace")).toBeVisible({ timeout: 15_000 });
    for (const bad of testData.json.invalid.slice(0, 2)) {
      await pasteInMonaco(page, bad, 0);
      await expect(page.locator(".jb-workspace span.text-red-400")).toHaveText("Invalid JSON", {
        timeout: 8_000,
      });
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("paragraph").filter({ hasText: "Invalid JSON" })).toBeVisible({
        timeout: 5_000,
      });
      await expect(page).toHaveURL(/\/documents\/new/);
    }
  });

  await report.check("Guest Editor", "FV-E05", "Invalid JSON: Minify shows notice", async () => {
    await page.goto("/documents/new");
    await pasteInMonaco(page, "{broken", 0);
    await page.locator('[title="Minify"]').first().click();
    await expect(page.locator(".jb-workspace").getByText("Invalid JSON").first()).toBeVisible({
      timeout: 8_000,
    });
  });

  await report.check("Guest Editor", "FV-E06", "Random valid JSON round-trip", async () => {
    await page.goto("/documents/new");
    const payload = testData.json.valid();
    await pasteInMonaco(page, payload, 0);
    await expect(page.locator(".jb-workspace span.text-emerald-400")).toHaveText("Valid JSON", {
      timeout: 8_000,
    });
    await page.getByRole("button", { name: /Format/i }).first().click();
    await expect(page.locator(".jb-workspace span.text-emerald-400")).toHaveText("Valid JSON");
  });

  // ── 3. Public View ───────────────────────────────────────────────────
  await report.check("Public View", "FV-P01", "Saved public URL loads", async () => {
    if (!publicViewUrl) throw new Error("No public view URL from FV-E03");
    await page.goto(publicViewUrl);
    await expect(page.locator(".jb-workspace, .jb-mobile-editor").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  await report.check("Public View", "FV-P02", "Reload keeps same document", async () => {
    const url = page.url();
    await page.reload();
    await expect(page).toHaveURL(url);
  });

  // ── 4. Compare JSON ──────────────────────────────────────────────────
  await report.check("Compare JSON", "FV-C01", "Compare page loads with sample diffs", async () => {
    await page.goto("/compare");
    await expect(page.getByRole("heading", { name: "Compare JSON" })).toBeVisible();
    await expectDiffTotal(page, (t) => t > 0);
  });

  await report.check("Compare JSON", "FV-C02", "Format both (valid JSON)", async () => {
    await page.getByRole("button", { name: "Format both" }).click();
    await expectToast(page, /Formatted both/i);
  });

  await report.check("Compare JSON", "FV-C03", "Swap A/B keeps page stable", async () => {
    const before = await page.locator("section").filter({ hasText: "Document A" }).textContent();
    await page.getByRole("button", { name: "Swap A/B" }).click();
    await expect(page.getByRole("heading", { name: "Compare JSON" })).toBeVisible();
    const after = await page.locator("section").filter({ hasText: "Document A" }).textContent();
    if (before === after) throw new Error("Swap A/B did not change pane content");
  });

  await report.check("Compare JSON", "FV-C04", "Ignore key order: reordered JSON matches", async () => {
    await setComparePaneText(page, "A", testData.json.reorderA);
    await setComparePaneText(page, "B", testData.json.reorderB);
    await page.getByLabel("Ignore key order").check();
    await expect(page.getByText(/identical/i)).toBeVisible({ timeout: 10_000 });
  });

  await report.check("Compare JSON", "FV-C05", "Invalid JSON transform shows error toast", async () => {
    await setComparePaneText(page, "A", "{not-valid-json");
    await transformPane(page, "A", "Minify");
    await expectToast(page, /Invalid JSON|Fix invalid JSON/i);
  });

  for (const bad of testData.json.invalid.slice(0, 2)) {
    await report.check(
      "Compare JSON",
      `FV-C06-${bad.slice(0, 8)}`,
      `Invalid JSON "${bad.slice(0, 20)}" blocks format both`,
      async () => {
        await setComparePaneText(page, "A", bad);
        await setComparePaneText(page, "B", testData.json.validPretty);
        await page.getByRole("button", { name: "Format both" }).click();
        await expectToast(page, /Fix invalid JSON|Invalid JSON/i);
      },
    );
  }

  await report.check("Compare JSON", "FV-C07", "Accept all from A toast", async () => {
    await page.goto("/compare");
    await expectDiffTotal(page, (t) => t > 0);
    await page.getByRole("button", { name: "Acc A" }).click();
    await expectToast(page, /Accepted all from A/i);
  });

  await report.check("Compare JSON", "FV-C08", "Diff navigation when diffs exist", async () => {
    await page.goto("/compare");
    await expectDiffTotal(page, (t) => t > 0);
    const next = page.getByTitle("Next difference");
    await expect(next).toBeEnabled({ timeout: 5_000 });
    await next.click();
    await page.getByTitle("Previous difference").click();
  });

  await report.check("Compare JSON", "FV-C09", "Pane mode Text / Tree / Table switches", async () => {
    const paneA = page.locator("section").filter({ has: page.getByText("Document A", { exact: true }) });
    for (const mode of ["tree", "table", "text"] as const) {
      await paneA.getByRole("button", { name: mode, exact: true }).click();
      await expect(paneA).toBeVisible();
    }
  });

  // ── 5. API Playground ────────────────────────────────────────────────
  await report.check("API Playground", "FV-A01", "Page loads", async () => {
    await page.goto("/api-playground");
    await expect(page.getByRole("heading", { name: "API Playground" })).toBeVisible({
      timeout: 10_000,
    });
  });

  await report.check("API Playground", "FV-A02", "GET /health returns 200", async () => {
    await page.getByRole("button", { name: "GET /health" }).click();
    await page.getByRole("button", { name: /^Send$/ }).click();
    await expect(page.getByText(/^200 /)).toBeVisible({ timeout: 15_000 });
  });

  await report.check("API Playground", "FV-A03", "Invalid path returns 404", async () => {
    await page.locator('input[placeholder="/path"]').fill(`/no-such-${Date.now()}`);
    await page.getByRole("button", { name: /^Send$/ }).click();
    await expect(page.getByText(/^404 /)).toBeVisible({ timeout: 15_000 });
  });

  // ── 6. Auth — Register (invalid then valid) ──────────────────────────
  await report.check("Auth / Register", "FV-R01", "Short password blocked (< 8 chars)", async () => {
    await page.goto("/register");
    await page.getByLabel(/^name$/i).fill("QA Bot");
    await page.getByLabel(/email/i).fill(`short_${validEmail}`);
    await page.getByLabel(/password/i).fill(testData.password.short);
    const ok = await page.getByLabel(/password/i).evaluate((el) => (el as HTMLInputElement).checkValidity());
    if (ok) throw new Error("Browser allowed password shorter than minLength=8");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  await report.check("Auth / Register", "FV-R02", "Invalid email format blocked", async () => {
    await page.getByLabel(/email/i).fill("not-an-email");
    const ok = await page.getByLabel(/email/i).evaluate((el) => (el as HTMLInputElement).checkValidity());
    if (ok) throw new Error("Browser accepted invalid email");
  });

  await report.check("Auth / Register", "FV-R03", "Valid registration succeeds", async () => {
    await page.goto("/register");
    await page.getByLabel(/^name$/i).fill("Feature QA");
    await page.getByLabel(/email/i).fill(validEmail);
    await page.getByLabel(/password/i).fill(validPassword);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 25_000 });
  });

  // ── 7. Auth — Login (invalid then valid) ─────────────────────────────
  await report.check("Route Guards", "FV-G01", "Guest /dashboard → login", async () => {
    await page.evaluate(() => localStorage.removeItem("jsonbob-auth"));
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  await report.check("Route Guards", "FV-G02", "Guest /settings → login", async () => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  await report.check("Auth / Login", "FV-LG01", "Wrong password shows error", async () => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(validEmail);
    await page.getByLabel(/password/i).fill("TotallyWrong99!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/login failed|invalid|incorrect|unauthorized/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/login/);
  });

  await report.check("Auth / Login", "FV-LG02", "Valid login succeeds", async () => {
    await page.getByLabel(/password/i).fill(validPassword);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 25_000 });
  });

  // ── 8. Dashboard (authenticated) ─────────────────────────────────────
  await report.check("Dashboard", "FV-D01", "Dashboard loads when authenticated", async () => {
    await expect(page.locator("#root")).not.toBeEmpty();
    await expectDesktopChrome(page);
  });

  await report.check("Dashboard", "FV-D02", "Random search string does not crash", async () => {
    const q = testData.randomSearch();
    const search = page.getByPlaceholder(/search/i).first();
    if ((await search.count()) === 0) throw new Error("Search input missing");
    await search.fill(q);
    await search.press("Enter");
    await expect(page.locator("#root")).not.toBeEmpty();
  });

  // ── 10. Authenticated editor + password visibility ───────────────────
  await report.check("Document Save", "FV-S01", "Create doc with valid JSON", async () => {
    await page.goto("/documents/new");
    await page.getByRole("button", { name: "Clear" }).click();
    await pasteInMonaco(page, testData.json.validPretty, 0);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/documents\/[A-Za-z0-9_-]+/, { timeout: 25_000 });
  });

  await report.check("Document Save", "FV-S02", "Password doc: short password blocked", async () => {
    await page.goto("/documents/new");
    await page
      .getByRole("combobox")
      .filter({ has: page.getByRole("option", { name: "Password" }) })
      .selectOption("password");
    const pwd = page.getByPlaceholder("Password");
    await expect(pwd).toBeVisible();
    await pwd.fill("abc");
    const ok = await pwd.evaluate((el) => (el as HTMLInputElement).checkValidity());
    if (ok) throw new Error("Browser allowed document password shorter than minLength=4");
  });

  await report.check("Document Save", "FV-S03", "Password doc: valid password saves", async () => {
    await page.getByPlaceholder("Password").fill("doc-pass-1234");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/documents\/[A-Za-z0-9_-]+/, { timeout: 25_000 });
  });

  // ── 11. Settings sections ────────────────────────────────────────────
  await report.check("Settings", "FV-ST01", "Settings page loads", async () => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({ timeout: 15_000 });
  });

  for (const section of ["Profile", "Appearance", "API Keys", "OAuth", "Organization", "Audit log"]) {
    await report.check("Settings", `FV-ST-${section}`, `${section} section opens`, async () => {
      await page.getByRole("button", { name: section }).click();
      await expect(page.locator("#root")).not.toBeEmpty();
    });
  }

  // Fail the Playwright run if any case failed (report already written in afterAll)
  const failed = report.getResults().filter((r) => r.status === "FAIL");
  expect(failed, `Failed cases: ${failed.map((f) => f.caseId).join(", ")}`).toHaveLength(0);
});
