import { test, expect } from "@playwright/test";
import { expectDesktopChrome } from "./helpers";
import { attachConsoleMonitor, step, uniqueEmail } from "./helpers/sequential";
import {
  acceptDialogs,
  closePalette,
  openPalette,
  paletteGo,
  runApiPlaygroundActions,
  runChromeMenus,
  runCompareAllActions,
  runDashboardAllActions,
  runEditorAllActions,
  runEditorInvalidJson,
  runOwnedDocumentActions,
  runSettingsAllActions,
} from "./helpers/completeFlow";
import { pasteInMonaco } from "./helpers/validationHelpers";

/**
 * Complete ordered frontend walkthrough — ONE tab, every feature, every action
 * in sequence before moving to the next section.
 * Map: docs/FRONTEND-USE-CASES.md (A → N)
 */
test.describe.configure({ mode: "serial" });

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("UC-001 → UC-193 complete feature flow (single tab, all actions)", async ({ page }) => {
  acceptDialogs(page);
  const console_ = attachConsoleMonitor(page);
  const testEmail = uniqueEmail();
  const testPassword = "TestPass123!";
  let publicViewUrl = "";

  // ═══════════════════════════════════════════════════════════════════════
  // A. Landing `/`
  // ═══════════════════════════════════════════════════════════════════════
  await step(page, "UC-001", "Landing page loads", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /JSON IDE for the edge/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  await step(page, "UC-002", "Hero CTAs visible", async () => {
    await expect(page.getByRole("link", { name: /open editor/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /view demo/i }).first()).toBeVisible();
  });

  await step(page, "UC-003", "FAQ accordion expands", async () => {
    await page.getByText("Is jsonbob free?").click();
    await expect(page.getByText(/guest editor/i).first()).toBeVisible({ timeout: 5_000 });
  });

  await step(page, "UC-005", "Feature strip cards visible", async () => {
    await expect(page.getByText(/Edit|Diff|Share|API/i).first()).toBeVisible();
  });

  await step(page, "UC-006", "Sign up CTA → /register", async () => {
    const signup = page.getByRole("link", { name: /sign up/i }).first();
    if (await signup.count()) {
      await signup.click();
      await expect(page).toHaveURL(/\/register/);
      await page.goBack();
    }
  });

  await step(page, "UC-004", "Footer Editor link → /documents/new", async () => {
    await page.getByRole("link", { name: "Editor" }).last().click();
    await expect(page).toHaveURL(/\/documents\/new/);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // B. Global chrome (desktop)
  // ═══════════════════════════════════════════════════════════════════════
  await step(page, "UC-010", "Header nav links", async () => {
    await expectDesktopChrome(page);
    await expect(page.getByRole("link", { name: "Compare" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "API" }).first()).toBeVisible();
  });

  await step(page, "UC-011", "Side rail navigation", async () => {
    const rail = page.getByRole("navigation", { name: "App navigation" });
    if (await rail.count()) {
      await expect(rail.getByRole("link", { name: "Editor" })).toBeVisible();
      await expect(rail.getByRole("link", { name: "Compare" })).toBeVisible();
    }
  });

  await step(page, "UC-012", "Command palette ⌘K", async () => {
    await openPalette(page);
    await closePalette(page);
  });

  await step(page, "UC-014", "Settings ▾ menu + theme", async () => {
    await runChromeMenus(page);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // C. Guest editor — all toolbar / panel / tools actions
  // ═══════════════════════════════════════════════════════════════════════
  await step(page, "UC-020", "Editor workspace visible", async () => {
    await page.goto("/documents/new");
    await expect(page.locator(".jb-workspace")).toBeVisible({ timeout: 15_000 });
  });

  await step(page, "UC-021–035", "All editor toolbar & panel actions", async () => {
    await runEditorAllActions(page);
  });

  await step(page, "UC-037", "Invalid JSON save blocked", async () => {
    await runEditorInvalidJson(page);
  });

  await step(page, "UC-036", "Guest Save valid JSON → /view/:id", async () => {
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/view\/[A-Za-z0-9_-]+/, { timeout: 25_000 });
    publicViewUrl = page.url();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // D. Public view
  // ═══════════════════════════════════════════════════════════════════════
  await step(page, "UC-040", "Public view workspace loads", async () => {
    await expect(page.locator(".jb-workspace, .jb-mobile-editor").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  await step(page, "UC-041", "Reload public view", async () => {
    await page.reload();
    await expect(page).toHaveURL(/\/view\//);
  });

  await step(page, "UC-042", "Copy URL on public view", async () => {
    const copy = page.getByRole("button", { name: /Copy URL/i });
    if (await copy.count()) await copy.click();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // E. Compare — every pane mode, transform, merge, toggle
  // ═══════════════════════════════════════════════════════════════════════
  await step(page, "UC-050", "Compare page load", async () => {
    await page.goto("/compare");
    await expect(page.getByRole("heading", { name: "Compare JSON" })).toBeVisible();
  });

  await step(page, "UC-051–063", "All compare actions (modes, merge, toggles)", async () => {
    await runCompareAllActions(page);
  });

  await step(page, "UC-063", "Open Editor link from compare", async () => {
    await page.getByRole("link", { name: "Open Editor" }).click();
    await expect(page).toHaveURL(/\/documents\/new/);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // F. API playground — send requests
  // ═══════════════════════════════════════════════════════════════════════
  await step(page, "UC-070–073", "API playground examples + Send", async () => {
    await page.goto("/api-playground");
    await runApiPlaygroundActions(page);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // G. Authentication
  // ═══════════════════════════════════════════════════════════════════════
  await step(page, "UC-080", "Guest /dashboard → login", async () => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  await step(page, "UC-081", "Guest /settings → login", async () => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  await step(page, "UC-082", "Guest /admin → login", async () => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  });

  await step(page, "UC-083", "Login form fields", async () => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  await step(page, "UC-084", "Login empty submit stays", async () => {
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  await step(page, "UC-086", "Register link", async () => {
    await page.getByRole("link", { name: "Register" }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  await step(page, "UC-088", "Register new account", async () => {
    await page.getByLabel(/^name$/i).fill("Complete Flow QA");
    await page.getByLabel(/email/i).fill(testEmail);
    await page.getByLabel(/password/i).fill(testPassword);
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 25_000 });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // H. Dashboard — filters, templates, trash, search
  // ═══════════════════════════════════════════════════════════════════════
  await step(page, "UC-100", "Dashboard loads", async () => {
    await expectDesktopChrome(page);
    await expect(page.getByRole("link", { name: "Library" }).first()).toBeVisible();
  });

  await step(page, "UC-101–113", "Dashboard filters, templates, trash tab", async () => {
    await runDashboardAllActions(page);
  });

  await step(page, "UC-108", "New JSON from dashboard", async () => {
    await page.getByRole("link", { name: "New JSON" }).click();
    await expect(page).toHaveURL(/\/documents\/new/);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // I. Owned document — save, share, duplicate, versions, delete
  // ═══════════════════════════════════════════════════════════════════════
  await step(page, "UC-120", "Create owned document", async () => {
    await page.getByRole("button", { name: "Clear" }).click();
    await pasteInMonaco(page, '{"owned":true,"version":1}', 0);
    await page
      .getByRole("combobox")
      .filter({ has: page.getByRole("option", { name: "Private" }) })
      .selectOption("private");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/documents\/[A-Za-z0-9_-]+/, { timeout: 25_000 });
  });

  await step(page, "UC-121–125", "Save, share sheet, copy URLs", async () => {
    await runOwnedDocumentActions(page);
  });

  await step(page, "UC-126", "Duplicate document", async () => {
    await page.getByRole("button", { name: "Duplicate" }).click();
    await expect(page).toHaveURL(/\/documents\/[A-Za-z0-9_-]+/, { timeout: 25_000 });
  });

  await step(page, "UC-127", "Delete document → trash", async () => {
    await expect(page.locator(".jb-workspace")).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Text" }).first().click();
    await page.getByRole("button", { name: "Duplicate" }).locator("+ button").click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  });

  await step(page, "UC-110–112", "Trash: restore then purge if item exists", async () => {
    await page.getByRole("button", { name: "Trash" }).click();
    const restore = page.getByRole("button", { name: "Restore" }).first();
    if (await restore.count()) {
      await restore.click();
      await page.getByRole("button", { name: "Trash" }).click();
      const purge = page.getByRole("button", { name: "Purge" }).first();
      if (await purge.count()) await purge.click();
    } else {
      await page.getByRole("button", { name: "Documents" }).click();
    }
  });

  // ═══════════════════════════════════════════════════════════════════════
  // J. Settings — all sections + every action
  // ═══════════════════════════════════════════════════════════════════════
  await step(page, "UC-140–151", "Settings all sections & actions", async () => {
    await page.goto("/settings");
    await runSettingsAllActions(page, `e2e-key-${Date.now()}`);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // K. Admin — non-admin redirect
  // ═══════════════════════════════════════════════════════════════════════
  await step(page, "UC-160", "Non-admin /admin forbidden or redirect", async () => {
    await page.goto("/admin");
    const url = page.url();
    const forbidden = page.getByText(/forbidden|not authorized|access denied/i);
    const ok = url.includes("/login") || url.includes("/dashboard") || (await forbidden.count()) > 0;
    if (!ok) throw new Error(`Unexpected admin access: ${url}`);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // L. Command palette — navigate all routes
  // ═══════════════════════════════════════════════════════════════════════
  await step(page, "UC-170", "Palette open / close", async () => {
    await page.goto("/documents/new");
    await openPalette(page);
    await closePalette(page);
  });

  await step(page, "UC-171", "Palette → Open Compare", async () => {
    await paletteGo(page, "Open Compare");
    await expect(page).toHaveURL(/\/compare/);
  });

  await step(page, "UC-172", "Palette → Open Editor", async () => {
    await paletteGo(page, "Open Editor");
    await expect(page).toHaveURL(/\/documents\/new/);
  });

  await step(page, "UC-173", "Palette → Dashboard", async () => {
    await paletteGo(page, "Open Library / Dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  await step(page, "UC-174", "Palette theme command", async () => {
    await paletteGo(page, "Theme: Dark");
  });

  await step(page, "UC-175", "Keyboard shortcuts modal", async () => {
    await openPalette(page);
    await page.getByPlaceholder(/Search commands/i).fill("Keyboard shortcuts");
    await page.getByRole("option", { name: "Keyboard shortcuts" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5_000 });
    await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // G (cont.). Logout
  // ═══════════════════════════════════════════════════════════════════════
  await step(page, "UC-091", "Logout → guest state", async () => {
    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.getByRole("link", { name: "Login" })).toBeVisible({ timeout: 10_000 });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // N. Error handling
  // ═══════════════════════════════════════════════════════════════════════
  await step(page, "UC-190", "Unknown route → home", async () => {
    await page.goto("/this-route-does-not-exist-qa");
    await expect(page).toHaveURL(/\//);
  });

  await step(page, "UC-191", "Re-open public view from start", async () => {
    if (publicViewUrl) {
      await page.goto(publicViewUrl);
      await expect(page).toHaveURL(/\/view\//);
    }
  });

  console_.assertClean();
});
