import { expect, type Locator, type Page } from "@playwright/test";
import { pasteInMonaco } from "./validationHelpers";

/** Click when present; skip on timeout (optional features). */
export async function clickIf(locator: Locator, opts?: { required?: boolean; timeout?: number }) {
  if ((await locator.count()) === 0) {
    if (opts?.required) throw new Error(`Required control not found: ${locator}`);
    return false;
  }
  try {
    await locator.first().click({ timeout: opts?.timeout ?? 6_000 });
    return true;
  } catch (err) {
    if (opts?.required) throw err;
    return false;
  }
}

async function closeOverlay(page: Page, ariaLabel: string) {
  await clickIf(page.getByRole("button", { name: ariaLabel }));
}

export function acceptDialogs(page: Page) {
  page.on("dialog", (d) => void d.accept());
}

export async function openPalette(page: Page) {
  const btn = page.getByTitle("Command palette").or(page.getByRole("button", { name: "⌘K" }));
  await btn.first().click();
  await expect(
    page.getByPlaceholder(/Search commands, documents, or JSON paths/i),
  ).toBeVisible({ timeout: 10_000 });
}

export async function closePalette(page: Page) {
  await page.keyboard.press("Escape");
}

export async function paletteGo(page: Page, label: string) {
  await openPalette(page);
  await page.getByPlaceholder(/Search commands, documents, or JSON paths/i).fill(label);
  await page.getByRole("option", { name: label }).first().click();
}

export async function comparePane(page: Page, pane: "A" | "B") {
  const title = pane === "A" ? "Document A" : "Document B";
  return page.locator("section").filter({ has: page.getByText(title, { exact: true }) });
}

/** All guest/authed editor toolbar + panel actions (order matters). */
export async function runEditorAllActions(page: Page) {
  await expect(page.locator(".jb-workspace")).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "New" }).click();
  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByRole("button", { name: "Reset" }).click();

  const layout = page.getByRole("combobox", { name: "Layout" });
  for (const opt of ["focus", "split", "review", "table"] as const) {
    await layout.selectOption(opt);
  }

  await page.locator('[title="Format (Ctrl+Shift+F)"]').first().click();
  await page.locator('[title="Minify"]').first().click();
  await page.locator('[title="Sort keys"]').first().click();
  await page.locator('[title="Copy"]').first().click();
  await page.locator('[title="Undo"]').first().click();
  await page.locator('[title="Redo"]').first().click();

  for (const view of ["Text", "Tree", "Table"] as const) {
    await page.getByRole("button", { name: view }).first().click();
  }

  await page.getByRole("button", { name: "Problems" }).click();
  await clickIf(page.getByRole("button", { name: "Attach schema" }));
  await clickIf(page.getByRole("button", { name: "Sample schema" }));
  await clickIf(page.getByRole("button", { name: "Clear schema" }));
  await clickIf(page.getByRole("button", { name: "Hide schema" }));

  await page.getByRole("button", { name: "Tree" }).first().click();
  await clickIf(page.getByTitle("Expand all"));
  await clickIf(page.getByTitle("Collapse all"));

  await clickIf(page.getByRole("button", { name: "JSON Tools" }));
  await clickIf(page.getByRole("button", { name: "Format / Pretty" }));
  await clickIf(page.getByRole("button", { name: "Sort keys" }).last());
  await closeOverlay(page, "Close tools");

  await clickIf(page.getByRole("button", { name: "Attach JSON Schema" }));
  await clickIf(page.getByRole("button", { name: "Attach JSON Schema" })); // toggle off

  await clickIf(page.getByRole("button", { name: "Split editor" }));
  await clickIf(page.getByRole("button", { name: "Split editor" }));

  await clickIf(page.getByRole("button", { name: "AI assistant" }));
  await closeOverlay(page, "Close AI");

  await clickIf(page.getByRole("checkbox", { name: "Live collab" }));
  await clickIf(page.getByRole("checkbox", { name: "Live collab" }));

  await page.getByRole("button", { name: "Text" }).first().click();
}

/** Invalid JSON then valid again before save. */
export async function runEditorInvalidJson(page: Page) {
  await pasteInMonaco(page, "{broken-json", 0);
  await expect(page.locator(".jb-workspace").getByText("Invalid JSON", { exact: true })).toBeVisible({
    timeout: 8_000,
  });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("paragraph").filter({ hasText: "Invalid JSON" })).toBeVisible({
    timeout: 5_000,
  });
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.locator(".jb-workspace").getByText("Valid JSON", { exact: true })).toBeVisible({
    timeout: 8_000,
  });
}

/** Every compare toolbar / pane / merge action in order. */
export async function runCompareAllActions(page: Page) {
  await expect(page.getByRole("heading", { name: "Compare JSON" })).toBeVisible();

  for (const pane of ["A", "B"] as const) {
    const section = await comparePane(page, pane);
    for (const mode of ["text", "tree", "table"] as const) {
      await section.getByRole("button", { name: mode, exact: true }).click();
    }
    await section.getByRole("button", { name: "tree", exact: true }).click();
    for (const t of ["Pretty print", "Minify", "Sort keys", "UPPERCASE keys"]) {
      await section.getByRole("button", { name: /Transform/ }).click();
      await section.getByRole("button", { name: t, exact: true }).click();
    }
    await clickIf(section.getByRole("button", { name: "Expand" }));
    await clickIf(section.getByRole("button", { name: "Collapse" }));
  }

  await page.getByRole("button", { name: "Format both" }).click();
  await page.getByRole("button", { name: "Swap A/B" }).click();
  await page.getByRole("checkbox", { name: "Sync scroll" }).check();
  await page.getByRole("checkbox", { name: "Ignore whitespace" }).check();
  await page.getByRole("checkbox", { name: "Ignore case" }).check();
  await page.getByRole("checkbox", { name: "Ignore key order" }).check();

  await page.getByTitle("Copy A → B", { exact: true }).click();
  await page.getByTitle("Copy B → A", { exact: true }).click();
  await page.getByTitle("Pretty-copy A → B", { exact: true }).click();
  await page.getByTitle("Pretty-copy B → A", { exact: true }).click();

  const next = page.getByTitle("Next difference");
  if (await next.isEnabled()) {
    await next.click();
    await page.getByTitle("Previous difference").click();
  }

  await page.getByRole("button", { name: "Acc A" }).click();
  await page.getByRole("button", { name: "Save to recent" }).click();

  const jump = page.getByLabel(/Jump to diff/i).first();
  if (await jump.count()) await jump.click();
}

export async function runApiPlaygroundActions(page: Page) {
  await expect(page.getByRole("heading", { name: "API Playground" })).toBeVisible();
  await page.getByRole("button", { name: "GET /health" }).click();
  await page.getByRole("button", { name: /^Send$/ }).click();
  await expect(page.getByText(/^200 /)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "GET /auth/me" }).click();
  await page.getByRole("button", { name: /^Send$/ }).click();
  await page.locator('input[placeholder="/path"]').fill("/api-docs");
  await page.getByRole("button", { name: /^Send$/ }).click();
  await expect(page.locator("pre").filter({ hasText: /openapi|paths|200/i }).first()).toBeVisible({
    timeout: 15_000,
  });
}

export async function runDashboardAllActions(page: Page) {
  await expect(page.locator("#root")).not.toBeEmpty();
  const search = page.getByPlaceholder(/Search by name or id/i);
  if (await search.count()) {
    await search.fill("qa");
    await search.press("Enter");
  }
  const vis = page.getByRole("combobox").filter({ has: page.getByRole("option", { name: "Public" }) });
  if (await vis.count()) {
    await vis.first().selectOption("Public");
    await vis.first().selectOption("");
  }
  const tagFilter = page.getByPlaceholder("Filter tag…");
  if (await tagFilter.count()) await tagFilter.fill("test");
  await clickIf(page.getByRole("checkbox", { name: "Favorites only" }));

  await clickIf(page.getByRole("button", { name: "Empty object" }));
  if (page.url().includes("/documents/new")) await page.goto("/dashboard");

  await page.getByRole("button", { name: "Trash" }).click();
  await page.getByRole("button", { name: "Documents" }).click();
  await clickIf(page.getByRole("button", { name: "Clear history" }));
}

export async function runSettingsAllActions(page: Page, keyName: string) {
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  await page.getByRole("button", { name: "Profile" }).click();
  const profileForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Save changes" }) });
  const nameField = profileForm.locator("label").filter({ hasText: /^Name$/ }).locator("input");
  if (await nameField.count()) {
    await nameField.fill("QA Complete Flow");
    await profileForm.getByRole("button", { name: "Save changes" }).click();
  }

  await page.getByRole("button", { name: "Appearance" }).click();
  for (const theme of ["System", "Light", "Dark"]) {
    await clickIf(page.getByRole("button", { name: theme }));
  }
  for (const accent of ["Orange (default)", "Green", "Blue", "Red"]) {
    await clickIf(page.getByRole("button", { name: accent }));
  }
  await clickIf(page.getByRole("checkbox", { name: "Show minimap" }));
  await clickIf(page.getByRole("checkbox", { name: "Format JSON on paste" }));

  await page.getByRole("button", { name: "API Keys" }).click();
  await page.getByPlaceholder("CI / SDK").fill(keyName);
  await page.getByRole("button", { name: "Create key" }).click();
  await expect(page.getByText(/Copy your secret now/i)).toBeVisible({ timeout: 15_000 });
  await clickIf(page.getByRole("button", { name: "Copy secret" }));

  await page.getByRole("button", { name: "OAuth" }).click();
  await expect(page.getByText(/OAuth|Google|GitHub/i).first()).toBeVisible();

  await page.getByRole("button", { name: "Organization" }).click();
  const orgName = page.getByPlaceholder("Acme Inc");
  if (await orgName.count()) {
    await orgName.fill(`QA Org ${Date.now()}`);
    await clickIf(page.getByRole("button", { name: "Create org" }));
  }

  await page.getByRole("button", { name: "Audit log" }).click();
  await expect(page.locator("#root")).not.toBeEmpty();

  // Revoke API key (back to API Keys)
  await page.getByRole("button", { name: "API Keys" }).click();
  const revoke = page.getByRole("button", { name: "Revoke" }).first();
  if (await revoke.count()) await revoke.click();
}

export async function runChromeMenus(page: Page) {
  await clickIf(page.getByRole("button", { name: /Settings/ }));
  await clickIf(page.getByRole("menuitemradio", { name: "Dark" }));
  await page.keyboard.press("Escape");
  await clickIf(page.getByRole("button", { name: /Help/ }));
  await clickIf(page.getByRole("menuitem", { name: "About jsonbob" }));
  await clickIf(page.getByRole("dialog").getByRole("button", { name: "Close" }));
  await page.keyboard.press("Escape");
}

export async function runOwnedDocumentActions(page: Page) {
  await expect(page.locator(".jb-workspace")).toBeVisible({ timeout: 15_000 });

  await pasteInMonaco(page, '{"step":"edited","v":2}', 0);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Saved/i).first()).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await clickIf(page.getByRole("button", { name: "Save settings" }));
  await clickIf(page.getByRole("button", { name: "Create one-time link" }));
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

  await clickIf(page.getByRole("button", { name: "Copy URL" }));
  await clickIf(page.getByRole("button", { name: "API URL" }));

  const restoreBtns = page.getByRole("button", { name: "Restore" });
  if ((await restoreBtns.count()) > 0) {
    await restoreBtns.first().click(); // confirm handled globally
  }
}
