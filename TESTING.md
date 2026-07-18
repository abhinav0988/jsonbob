# jsonbob — Testing Guide

**Updated:** 2026-07-17  
**Live:** https://jsonbob-web.blobforges.workers.dev · API https://jsonbob-api.blobforges.workers.dev

Inventory of **all testing types**, how to run them, and coverage map.

---

## Quick status

| Type | Status | Count | Command |
|------|--------|------:|---------|
| Unit — frontend | ✅ | **8** | `npm test --prefix frontend` |
| Unit — worker | ✅ | **2** | `npm test --prefix worker` |
| Smoke — raw JSON | ✅ | 1 flow | `npm run smoke --prefix frontend` |
| Smoke — full API | ✅ | **42** asserts | `npm run smoke:full --prefix frontend` |
| Viewport E2E (Playwright) | ✅ | **32** | `npm run test:views --prefix frontend` |
| Typecheck / build | ✅ | — | worker `tsc` · frontend `build` |
| Lint | ✅ (warn) | — | `npm run lint --prefix frontend` |
| All-in-one | ✅ | — | `npm run test:all` (repo root) |

**Totals:** **85 automated checks** (10 unit + 42 smoke + 1 raw flow + 32 viewport).

---

## Test pyramid

```text
                    ┌─────────────────────┐
                    │  Viewport E2E       │  ← Playwright (desktop / tablet / mweb)
                    │  (32 cases)         │
                ┌───┴─────────────────────┴───┐
                │  Live smoke (API/web)       │  ← smoke + smoke:full (42)
                │                             │
            ┌───┴─────────────────────────────┴───┐
            │  Unit (libs) + tsc + lint + build   │  ← 10 unit
            └─────────────────────────────────────┘
```

---

## 1. Unit tests

### Frontend — Node test runner

| | |
|--|--|
| **File** | `frontend/src/lib/jsonTools.test.ts` |
| **Script** | `npm test --prefix frontend` |
| **Count** | **8** |

| Suite | Cases |
|-------|-------|
| `collectJsonPaths` | nested walk |
| `jsonSchemaValidate` | required/email · uniqueItems |
| `resolveApiBaseUrl` | env slash strip · prod fallback · empty prod-only |
| `jsonPath` | tokenize / get / set |
| `jsonDiff` | value_changed + summarize |

### Worker — Vitest

| | |
|--|--|
| **File** | `worker/src/lib/json.test.ts` |
| **Script** | `npm test --prefix worker` |
| **Count** | **2** |

| Suite | Cases |
|-------|-------|
| `sanitizeJson` | strip `__proto__` / `constructor` |
| byte size | `byteSize > 0` |

---

## 2. Smoke tests (live)

Env defaults to production workers.dev.

| Variable | Default |
|----------|---------|
| `JSONBOB_API_URL` | `https://jsonbob-api.blobforges.workers.dev` |
| `JSONBOB_WEB_URL` | `https://jsonbob-web.blobforges.workers.dev` |

### Smoke A — raw JSON (`npm run smoke`)

1. `GET /health`
2. `POST /api/json`
3. `GET /json/:id` must be JSON, never SPA HTML

### Smoke B — full suite (`npm run smoke:full`) — **42 asserts**

| Section | Coverage |
|---------|----------|
| Routing / deploy | Web login POST **405**; API login works; SPA HTML; **bundle embeds API host** |
| Health | `/health` `/ready` `/api-docs` |
| CORS | OPTIONS from web → ACAO web |
| Auth | register · login · me · bad password · refresh · Google/GitHub status |
| Documents | CRUD · duplicate · favorite · tags · folder · **schema** · **versions** · **one-time** · trash |
| Platform | profile · audit · orgs · analytics · API keys · anon blob |
| AI | `POST /ai/assist` with `prompt`+`jsonText` → **200 + reply** |

---

## 3. Viewport E2E (Playwright)

Tests **web (desktop)**, **mweb (mobile)**, and **tablet** layouts against the built SPA.

| | |
|--|--|
| **Config** | `frontend/playwright.config.ts` |
| **Spec** | `frontend/e2e/viewports.spec.ts` |
| **Helpers** | `frontend/e2e/helpers.ts` |
| **Script** | `npm run test:views --prefix frontend` |

### Viewports

| Project | Size | What it validates |
|---------|------|-------------------|
| `desktop-chrome` | 1440×900 | Desktop header nav, workspace editor, compare split, API host in bundle |
| `mobile-iphone` | 390×844 | Bottom nav + FAB, mobile editor, compare cards, search sheet, touch targets |
| `tablet-ipad` | 834×1194 | Desktop chrome at ≥768px, no horizontal scroll on landing |

### Run locally

```bash
# Build first (preview server auto-starts via playwright webServer)
npm run build --prefix frontend
npm run test:views --prefix frontend

# Against live deploy
PLAYWRIGHT_BASE_URL=https://jsonbob-web.blobforges.workers.dev npm run test:views --prefix frontend
```

First run needs Chromium: `cd frontend && npx playwright install chromium`

HTML report: `frontend/playwright-report/index.html`

---

## 4. Static gates

| Check | Command |
|-------|---------|
| Worker types | `cd worker && npx tsc --noEmit` |
| Frontend build | `npm run build --prefix frontend` |
| Lint | `npm run lint --prefix frontend` |

---

## 5. CI

**File:** `.github/workflows/ci.yml`

| Job | Gates |
|-----|-------|
| `worker` | `tsc` · `npm test` |
| `frontend` | `build` · `npm test` · **Playwright viewports** · `smoke` · `smoke:full` · `lint` |

Root helper: `npm run test:all`

---

## 6. Run everything

```bash
npm run test:all
```

Piecemeal:

```bash
npm test --prefix frontend
npm test --prefix worker
cd worker && npx tsc --noEmit
npm run build --prefix frontend
npm run lint --prefix frontend
npm run smoke --prefix frontend
npm run smoke:full --prefix frontend
npm run test:views --prefix frontend
```

---

## 7. Coverage map

| Feature | Unit | Smoke | Viewport | Status |
|---------|:----:|:-----:|:--------:|--------|
| Health / ready / OpenAPI | | ✅ | | Working |
| Anon raw JSON | | ✅ | | Working |
| Auth register/login/refresh | | ✅ | login form | Working |
| API base / no SPA 405 | ✅ | ✅ | bundle | Working |
| Documents CRUD + meta | | ✅ | | Working |
| Desktop editor workspace | | | ✅ | Working |
| Mobile editor / nav / FAB | | | ✅ | Working |
| Tablet desktop layout | | | ✅ | Working |
| Compare desktop / mobile | | | ✅ | Working |
| Path / diff / schema libs | ✅ | | | Working |

---

## 8. File index

```text
TESTING.md
package.json                       # test:all includes test:views
frontend/playwright.config.ts
frontend/e2e/viewports.spec.ts
frontend/e2e/helpers.ts
frontend/src/lib/jsonTools.test.ts
frontend/scripts/smoke-raw.mjs
frontend/scripts/smoke-full.mjs
worker/src/lib/json.test.ts
.github/workflows/ci.yml
```

---

## 9. Counting cheat-sheet

| Bucket | Number |
|--------|-------:|
| Unit tests | **10** |
| Smoke asserts (full) | **42** |
| Smoke flows (raw) | **1** |
| Viewport E2E | **32** |
| **Automated total** | **85** |

When adding a feature: unit for pure logic · smoke assert for every new public route · viewport test for responsive UI changes.
