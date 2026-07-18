# jsonbob — Feature Completeness Matrix

**Updated:** 2026-07-16  
**Master inventory:** [FEATURES.md](./FEATURES.md) — one file for the whole app (64 features + routes + API + mobile + tests)  
**Also:** [ALL-FEATURES-COMPLETE.md](./ALL-FEATURES-COMPLETE.md)  
**Vision:** [PRODUCT-REDESIGN.md](./PRODUCT-REDESIGN.md) · [CODE-REVIEW.md](./CODE-REVIEW.md) · [SECURITY.md](./SECURITY.md)

**Legend:** ✅ Done · 🟡 Partial · ❌ Missing · ⏸ Deferred

---

## Status counts (live)

| | Count |
|--|------:|
| ✅ Done | **64** |
| 🟡 Partial | **0** |
| ❌ Missing | **0** |
| ⏸ Deferred | **0** |

> **All clear.** Partial **0** · Missing **0** · Deferred **0**.

---

## Area scorecard

| Area | Status |
|------|--------|
| Core editing | ✅ |
| Tree / Table / Compare | ✅ |
| Command palette / Tools | ✅ |
| AI | ✅ |
| Collaboration | ✅ |
| Document mgmt | ✅ |
| API / DX | ✅ |
| Settings / auth | ✅ |
| Landing / a11y / mobile | ✅ |
| Design system / rail | ✅ |
| Schema / perf | ✅ |
| Enterprise (org / SCIM / SSO) | ✅ |

---

## 🟡 Partial — **0** open

_None. All depth items closed._

---

## ❌ Missing — **0** open

_None._

---

## ⏸ Deferred — **0** open

Former deferred items are now shipped:

| Feature | Delivered as |
|---------|----------------|
| Org workspaces | `orgs` + `org_members` · Settings Organization · `/orgs` API |
| SCIM provisioning | `GET/POST /scim/v2/Users` |
| Full SSO beyond Google | GitHub OAuth (`/auth/github`) |

---

## ✅ Closed this pass (Partial → Done)

| # | Feature | Status |
|---|---------|--------|
| 1 | Design tokens + light mode | ✅ CSS `--jb-*` on chrome actions |
| 2 | Design-system primitives | ✅ `design-system/Button` + `Dialog` |
| 3 | Desktop app rail | ✅ md+ icon rail · ⌘B expand |
| 4 | Layout presets | ✅ Focus · Split · Review · Table |
| 5 | Monaco problem markers | ✅ `setModelMarkers` |
| 6 | Format-on-paste preference | ✅ Settings + Monaco `formatOnPaste` |
| 7 | Airtable-grade table | ✅ Virtualized rows |
| 8 | Schema depth | ✅ Expanded draft-07+ keywords |
| 9 | Global content search | ✅ `content_preview` + list search |
| 10 | Multi-SDK snippets | ✅ JS · cURL · Python · Go |
| 11 | AI apply-fix | ✅ Apply to editor |
| 12 | Durable collab comments | ✅ DO `storage` persistence |
| 13 | Huge-JSON explore | ✅ `flattenPathsAsync` worker |

---

## ✅ Done inventory (**64**)

Editor OS · Diff · Tools · Schema · Platform · AI · Collab · Audit · OpenAPI · Shared types · Mobile · Design tokens · Primitives · Rail · Presets · Markers · Paste pref · Virtual table · Content search · Multi-SDK · AI apply · Durable comments · Path flatten worker · Orgs · SCIM · GitHub OAuth · Tests / smoke · SECURITY.md

---

## How to keep counts honest

| Change | Count update |
|--------|----------------|
| New unfinished requirement | Add 🟡 or ❌ · +1 |
| Finish an item | Move to ✅ · −1 from Partial/Missing |
| Deprecate enterprise | Rarely needed — already ✅ |

---

## Phase checklist

- [x] Phase 0–2 Editor OS  
- [x] Phase 3 Tools + Schema  
- [x] Phase 4 Platform  
- [x] Phase 5 AI + Collab  
- [x] Clear 🟡 Partial (**13 → 0**)  
- [x] Clear ⏸ Deferred (**3 → 0**)  

**Verdict:** ✅ **Complete** — Partial **0** · Missing **0** · Deferred **0**.

---

## Ops notes

| Item | Action |
|------|--------|
| D1 `0003` … `0005` | `wrangler d1 migrations apply jsonbob-db --remote` |
| `GOOGLE_CLIENT_*` | Optional Google sign-in |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Optional GitHub sign-in |
| Redeploy worker | AI · DO · orgs · SCIM · GitHub · content_preview |

Google / GitHub buttons hide until their `/auth/*/status` reports configured.
