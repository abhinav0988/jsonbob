# jsonbob — Code Review (Staff Engineer)

**Scope:** `frontend/` + `worker/` as of 2026-07-17  
**Companion:** [PRODUCT-REDESIGN.md](./PRODUCT-REDESIGN.md) · [FEATURE-COMPLETE.md](./FEATURE-COMPLETE.md)

---

## Executive verdict

**Solid Cloudflare JSON IDE** — feature matrix complete. Production login was broken by a deploy config bug (fixed and redeployed).

**Incident (P0):** `POST https://jsonbob-web…/auth/login` → **405** because production SPA built with empty `VITE_API_BASE_URL`, so axios posted to the assets worker instead of the API.

**Fix shipped:** `.env.production` + `getApiBaseUrl()` with prod fallback · web redeployed · `npm run smoke:full` coverage.

**Grade:** A product · **A− frontend** (config footgun closed) · **A− backend**

Live: https://jsonbob-web.appsphere.workers.dev · API https://jsonbob-api.appsphere.workers.dev

### 2026-07-17 verification

- ✅ Frontend: build + 8 unit tests
- ✅ Worker: TypeScript + 2 unit tests
- ✅ Live API: raw smoke + 42/42 full smoke assertions
- ✅ Responsive UI: 32 Playwright checks across desktop, tablet, and mobile
- ⚠️ Lint: no errors; 2 Fast Refresh organization warnings remain
- ⚠️ Bundle: main JavaScript chunk is ~827 kB (~253 kB gzip)

Issues fixed during verification:

1. Updated stale `blobforge.workers.dev` production references to `appsphere.workers.dev`.
2. Made smoke and lint failures blocking in CI instead of `continue-on-error`.
3. Fixed Playwright mobile execution to use the Chromium browser installed by CI.
4. Prevented Vite Preview from proxying the SPA route `/documents/new` to the API.
5. Stabilized `JsonTableView` memo dependencies and removed five lint warnings.

---

## Incident review — login 405

| | |
|--|--|
| **Symptom** | Browser `POST /auth/login` on web origin → 405 Method Not Allowed |
| **Root cause** | Vite baked `baseURL: ""`; relative `/auth/login` hit SPA Worker (static assets only) |
| **Why CORS looked fine** | API CORS was correct; traffic never reached the API from the form |
| **Fix** | `frontend/.env.production` · `src/lib/apiBase.ts` · all call sites use `getApiBaseUrl()` |
| **Regression guard** | `scripts/smoke-full.mjs` asserts bundle contains API host + API login ≠ 405 |
| **CI must** | Always set `VITE_API_BASE_URL` in frontend build (GH Actions / Pages / Wrangler) |

---

## [Bugbot](804d042f-392f-4e21-8707-e4e43076a276) findings

| Severity | Location | Finding |
|----------|----------|---------|
| High | `frontend/src/lib/apiBase.ts` | Optional-chain miss: `?.trim().replace()` threw when env missing — **fixed** to safe trim before replace |

---

## 1. Architecture

### What’s good
- Clear split: Hono Worker = data plane; Vite React = control plane  
- D1 + R2 pattern for metadata vs JSON body is correct  
- Queues + cron for expiry/analytics show production thinking  
- Zustand persist for auth/theme; React Query for server state  

### What’s weak
| Issue | Detail | Rec |
|-------|--------|-----|
| Dual URL model fragile | `APP_URL` / `API_URL` / `VITE_*` must stay in sync | `getApiBaseUrl` + health assert in CI |
| Large page components | Compare / Workspace still heavy | Keep extracting `features/*` |

---

## 2. Frontend review

### Security / auth
- ✅ Bearer attach + refresh-on-401 via absolute API base  
- ✅ Production never falls back to relative API paths  
- ⚠️ Tokens in `localStorage` (XSS risk) — fine for MVP; document; consider httpOnly cookie BFF later  

### Testing
- Unit: `jsonTools` / schema  
- Live: `npm run smoke` (raw JSON) · `npm run smoke:full` (auth + docs + CORS + deploy assert)

---

## 3. Worker / API review

### What’s good
- Zod on mutating routes · rate limits · sanitizeJson · versions · OpenAPI  

### Residual
| Severity | Finding | Rec |
|----------|---------|-----|
| Low | OpenAPI drift possible vs new org/SCIM routes | Keep regenerating |
| Info | Google/GitHub secrets optional | OAuth buttons stay hidden until configured |

### Multi-tenant safety
- Owner checks on update/delete/versions look correct  
- CORS allowlist + deny without ACAO  

---

## 4. Config & deploy review

| Item | Status |
|------|--------|
| `VITE_API_BASE_URL` in prod build | ✅ `.env.production` + runtime fallback |
| Workers SPA assets | ✅ `not_found_handling: single-page-application` |
| D1 migrations remote | ✅ `0002`–`0005` applied |
| GH Actions | Gate build on `VITE_API_BASE_URL` |

---

## 5. Priority backlog (post-closeout)

### P0
1. ~~Absolute API base in production~~ ✅  
2. ~~Smoke:full live suite~~ ✅  
3. ~~Rotate placeholder production JWT secrets~~ ✅ Rotated 2026-07-17;
   existing sessions were intentionally invalidated.

### P1
4. Move mutating `smoke:full` CI runs from production to staging
5. Playwright UI login/save path  
6. Set `GOOGLE_CLIENT_*` / `GITHUB_CLIENT_*` when ready  

### P2
7. Observability / structured Worker logs  
8. Optional httpOnly session BFF  

---

## 6. Security checklist

| Item | |
|------|--|
| SQL via prepared statements | Pass |
| Password hashing | Pass |
| Rate limits | Pass |
| CORS allowlist | Pass |
| API origin vs SPA origin | Pass (fixed 405) |
| AuthZ owner checks | Pass spot-check |
| Secret management | Pass — production JWT secrets rotated 2026-07-17 |

---

## 7. Summary for leadership

Feature work is complete. The **deploy-time env footgun** was the last P0 production breaker; fixed with baked URL + fallback + automated smoke. Next investment: **CI smoke on every deploy** and OAuth secret rollout.
