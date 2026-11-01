# jsonbob — Frontend Use Cases (Line-by-Line)

**Purpose:** Manual + automated checklist for **every frontend route and action**, tested **in order**, **one browser tab**, not random parallel clicks.

**Automated runner:** `npm run test:e2e:sequential --prefix frontend`  
Runs **one tab**, **fixed order A→N**, clicks **every action inside each feature** before moving on.

**Live URLs:** Web https://jsonbob-web.abhinavmangal68.workers.dev · API https://jsonbob-api.abhinavmangal68.workers.dev

---

## How to run (important)

Always from project root:

```bash
cd /home/abhinav/Videos/MyProjects/jsonbob

# Install browser once
cd frontend && npx playwright install chromium && cd ..

# Slow, single-tab, line-by-line (local preview)
npm run test:e2e:sequential --prefix frontend

# Same, but watch in Chrome
PLAYWRIGHT_HEADED=1 PLAYWRIGHT_SLOW_MO=600 npm run test:e2e:sequential --prefix frontend

# Against live deploy
PLAYWRIGHT_BASE_URL=https://jsonbob-web.abhinavmangal68.workers.dev \
  PLAYWRIGHT_HEADED=1 \
  npm run test:e2e:sequential --prefix frontend
```

| Env var | Default | Meaning |
|---------|---------|---------|
| `PLAYWRIGHT_SLOW_MO` | `400` | Delay between Playwright actions (ms) |
| `PLAYWRIGHT_STEP_MS` | `600` | Pause after each use-case step (ms) |
| `PLAYWRIGHT_HEADED` | off | `1` = visible Chrome window |
| `PLAYWRIGHT_BASE_URL` | local preview | Set to live web URL for prod |

**Report:** `frontend/playwright-report-sequential/index.html`

---

## Routes map

| # | Route | Page | Auth |
|---|-------|------|:----:|
| R1 | `/` | Landing | Public |
| R2 | `/login` | Login | Public |
| R3 | `/register` | Register | Public |
| R4 | `/login/oauth` | OAuth callback | Public |
| R5 | `/documents/new` | Guest / new editor | Public |
| R6 | `/documents/:id` | Owned document editor | Yes |
| R7 | `/view/:id` | Public shared JSON | Public |
| R8 | `/compare` | Compare JSON | Public |
| R9 | `/api-playground` | API playground | Public |
| R10 | `/dashboard` | Document library | Yes |
| R11 | `/settings` | Settings | Yes |
| R12 | `/admin` | Admin dashboard | Admin |

---

## Use cases — line by line

Check each row: **Pass / Fail / N/A**. Automated ID matches `sequential.spec.ts`.

### A. Landing `/` (guest)

| ID | Step | Expected result | Auto |
|----|------|-----------------|:----:|
| UC-001 | Open `/` | Hero headline visible, no console fatal errors | ✅ |
| UC-002 | Verify CTAs | "Open editor", "View demo" links visible | ✅ |
| UC-003 | FAQ accordion | Click "Is jsonbob free?" → answer expands | ✅ |
| UC-004 | Footer Editor link | Navigates to `/documents/new` | ✅ |
| UC-005 | Feature strip | Edit / Diff / Share / API cards visible | Manual |
| UC-006 | Sign up CTA (guest) | Link to `/register` works | Manual |
| UC-007 | Hero Monaco demo | Typed JSON animation or static preview | Manual |
| UC-008 | Reduced motion | No crash when `prefers-reduced-motion` | Manual |

### B. Global chrome (desktop ≥768px)

| ID | Step | Expected result | Auto |
|----|------|-----------------|:----:|
| UC-010 | Header nav | Editor · Compare · API · Login/Sign up | ✅ |
| UC-011 | Side rail | App navigation links visible (⌘B expand) | Manual |
| UC-012 | ⌘K palette | Opens command search modal | ✅ |
| UC-013 | Document tabs | Tab bar on editor routes | Manual |
| UC-014 | Settings ▾ menu | Dropdown opens | Manual |
| UC-015 | Help ▾ menu | Dropdown opens | Manual |

### C. Guest editor `/documents/new`

| ID | Step | Expected result | Auto |
|----|------|-----------------|:----:|
| UC-020 | Page load | `.jb-workspace` visible (desktop) | ✅ |
| UC-021 | Toolbar New | Resets to snapshot JSON | Manual |
| UC-022 | Toolbar Clear | Sets empty `{}` template | Manual |
| UC-023 | Toolbar Reset | Restores initial sample | Manual |
| UC-024 | Format | Pretty-prints JSON | ✅ |
| UC-025 | Minify | Minifies JSON | Manual |
| UC-026 | Tree panel | Tree search placeholder visible | ✅ |
| UC-027 | Table panel | Table view renders | ✅ |
| UC-028 | Problems panel | Shows issues or "no issues" | ✅ |
| UC-029 | Layout preset | Focus / Split / Review / Table switch | ✅ |
| UC-030 | JSON Tools drawer | Opens tools cabinet | Manual |
| UC-031 | Attach JSON Schema | Schema attach UI opens | Manual |
| UC-032 | Split editor toggle | Vertical split Monaco | Manual |
| UC-033 | AI assistant button | AI panel opens | Manual |
| UC-034 | Live collab toggle | Collab UI appears | Manual |
| UC-035 | Breadcrumbs | Path navigation updates on tree click | Manual |
| UC-036 | Guest Save (valid JSON) | Redirect to `/view/:id` | ✅ |
| UC-037 | Guest Save (invalid JSON) | Error banner, stay on page | Manual |
| UC-038 | Drag-drop JSON file | Content loads in editor | Manual |

### D. Public view `/view/:id`

| ID | Step | Expected result | Auto |
|----|------|-----------------|:----:|
| UC-040 | Open saved public URL | Workspace loads | ✅ |
| UC-041 | Reload page | Same JSON still loads | ✅ |
| UC-042 | Copy URL button | Copies to clipboard | Manual |
| UC-043 | Raw API link | Points to API `/json/:id` | Manual |
| UC-044 | Password-protected doc | Password gate if protected | Manual |

### E. Compare `/compare`

| ID | Step | Expected result | Auto |
|----|------|-----------------|:----:|
| UC-050 | Page load | Heading "Compare JSON" | ✅ |
| UC-051 | Diff stats | Total / missing counts visible | ✅ |
| UC-052 | Document A / B panes | Both sides render | Manual |
| UC-053 | Text / Tree / Table mode | Mode buttons switch view | Manual |
| UC-054 | Swap A/B | Sides swap, page stable | ✅ |
| UC-055 | Format both | Both panes formatted | ✅ |
| UC-056 | Next / Previous diff | Diff counter advances | ✅ |
| UC-057 | Ignore whitespace | Toggle works | ✅ |
| UC-058 | Ignore case | Toggle works | Manual |
| UC-059 | Ignore key order | Toggle works | Manual |
| UC-060 | Merge path A→B | Target JSON updates | Manual |
| UC-061 | Accept all from A | Bulk merge | Manual |
| UC-062 | Diff minimap | Click jumps to diff | Manual |
| UC-063 | Open Editor link | Goes to `/documents/new` | Manual |

### F. API playground `/api-playground`

| ID | Step | Expected result | Auto |
|----|------|-----------------|:----:|
| UC-070 | Page load | Playground UI visible | ✅ |
| UC-071 | Method selector | GET/POST/PUT/DELETE | Manual |
| UC-072 | Send request | Response panel updates | Manual |
| UC-073 | SDK snippet tabs | JS / cURL / Python / Go | Manual |

### G. Authentication

| ID | Step | Expected result | Auto |
|----|------|-----------------|:----:|
| UC-080 | Guest `/dashboard` | Redirect to `/login` | ✅ |
| UC-081 | Guest `/settings` | Redirect to `/login` | Manual |
| UC-082 | Guest `/admin` | Redirect to `/login` | Manual |
| UC-083 | Login page fields | Email + password visible | ✅ |
| UC-084 | Login empty submit | Stays on `/login` | ✅ |
| UC-085 | Login bad password | Error message shown | Manual |
| UC-086 | Register link | Navigates to `/register` | ✅ |
| UC-087 | Register form | Name + email + password | Manual |
| UC-088 | Register success | Redirect to `/dashboard` | ✅ |
| UC-089 | Google OAuth button | Visible only if configured | Manual |
| UC-090 | GitHub OAuth button | Visible only if configured | Manual |
| UC-091 | Logout | Returns to guest state | Manual |

### H. Dashboard `/dashboard` (authenticated)

| ID | Step | Expected result | Auto |
|----|------|-----------------|:----:|
| UC-100 | Page load | Library / analytics visible | ✅ |
| UC-101 | Search documents | Filters list | ✅ |
| UC-102 | Visibility filter | Public / private filter | Manual |
| UC-103 | Tag filter | Filters by tag | Manual |
| UC-104 | Folder filter | Filters by folder | Manual |
| UC-105 | Favorites only | Shows starred docs | Manual |
| UC-106 | Templates gallery | Click template → editor with content | Manual |
| UC-107 | Recent documents | Recent list shows items | Manual |
| UC-108 | Create new document | Opens `/documents/new` | ✅ |
| UC-109 | Open document row | Navigates to `/documents/:id` | Manual |
| UC-110 | Trash tab | Shows deleted documents | Manual |
| UC-111 | Restore from trash | Document restored | Manual |
| UC-112 | Purge trash | Permanent delete | Manual |
| UC-113 | Storage quota bar | Shows usage percentage | Manual |

### I. Owned document `/documents/:id` (authenticated)

| ID | Step | Expected result | Auto |
|----|------|-----------------|:----:|
| UC-120 | Open document | Editor loads saved JSON | Manual |
| UC-121 | Save changes | Persists to server | Manual |
| UC-122 | Share sheet | Opens share modal | Manual |
| UC-123 | Set visibility public/private/password | Saves settings | Manual |
| UC-124 | Set expiry | Saves TTL | Manual |
| UC-125 | One-time burn link | Generates OT URL | Manual |
| UC-126 | Duplicate document | Creates copy | Manual |
| UC-127 | Delete document | Moves to trash | Manual |
| UC-128 | Version history list | Shows versions | Manual |
| UC-129 | Restore version | Content reverted | Manual |
| UC-130 | Attach / edit schema | Schema saved | Manual |

### J. Settings `/settings` (authenticated)

| ID | Step | Expected result | Auto |
|----|------|-----------------|:----:|
| UC-140 | Page load | Settings heading | ✅ |
| UC-141 | Profile section | Name, password fields | ✅ |
| UC-142 | Save profile | Success toast / no error | Manual |
| UC-143 | Appearance section | Theme + accent options | ✅ |
| UC-144 | Theme dark / light / system | UI theme changes | Manual |
| UC-145 | Format-on-paste toggle | Preference saves | Manual |
| UC-146 | API Keys section | List + create key | ✅ |
| UC-147 | Create API key | Key shown once | Manual |
| UC-148 | Revoke API key | Key removed | Manual |
| UC-149 | OAuth section | Google/GitHub status | ✅ |
| UC-150 | Organization section | Create/list orgs | ✅ |
| UC-151 | Audit log section | Action history list | ✅ |

### K. Admin `/admin` (admin role only)

| ID | Step | Expected result | Auto |
|----|------|-----------------|:----:|
| UC-160 | Non-admin access | Redirect or forbidden | Manual |
| UC-161 | Platform stats | Users / docs / storage counts | Manual |
| UC-162 | User list | Shows all users | Manual |
| UC-163 | Change user role | Role updates | Manual |
| UC-164 | Document moderation | Search + delete any doc | Manual |

### L. Command palette & shortcuts

| ID | Step | Expected result | Auto |
|----|------|-----------------|:----:|
| UC-170 | ⌘K open / Escape close | Modal toggles | ✅ |
| UC-171 | Navigate → Open Compare | Goes to `/compare` | ✅ |
| UC-172 | Navigate → Open Editor | Goes to `/documents/new` | Manual |
| UC-173 | Navigate → Dashboard | Goes to `/dashboard` | Manual |
| UC-174 | Theme switch commands | Theme changes | Manual |
| UC-175 | Shortcuts modal | Keyboard help overlay | Manual |

### M. Mobile web (<768px)

| ID | Step | Expected result | Auto |
|----|------|-----------------|:----:|
| UC-180 | Bottom nav visible | Home · Documents · Search · Profile | Manual |
| UC-181 | FAB Create menu | New JSON / Paste / Import | Manual |
| UC-182 | Mobile editor shell | `.jb-mobile-editor` | Manual |
| UC-183 | Mobile toolbar chips | Format · Tree · Issues | Manual |
| UC-184 | Search bottom sheet | Dialog + search input | Manual |
| UC-185 | Mobile compare cards | Version A / B tabs | Manual |
| UC-186 | Touch-friendly login | Button height ≥40px | Manual |

### N. Error handling & a11y

| ID | Step | Expected result | Auto |
|----|------|-----------------|:----:|
| UC-190 | Unknown route `/foo` | Redirect to `/` | Manual |
| UC-191 | No fatal console errors | Clean console per page | ✅ |
| UC-192 | Network API failure | Toast / inline error | Manual |
| UC-193 | Focus visible on tab | Keyboard navigation works | Manual |

---

## Summary counts

| Bucket | Total cases | Automated in sequential |
|--------|------------:|------------------------:|
| A Landing | 8 | 4 |
| B Chrome | 6 | 2 |
| C Guest editor | 19 | 8 |
| D Public view | 5 | 2 |
| E Compare | 14 | 6 |
| F API playground | 4 | 1 |
| G Auth | 12 | 6 |
| H Dashboard | 14 | 3 |
| I Owned doc | 11 | 0 |
| J Settings | 12 | 7 |
| K Admin | 5 | 0 |
| L Palette | 6 | 3 |
| M Mobile | 7 | 0 |
| N Errors/a11y | 4 | 1 |
| **Total** | **129** | **~95** (single-tab complete flow) |

---

## Difference vs fast parallel tests

| | `test:views` / `test:e2e` | `test:e2e:sequential` |
|--|---------------------------|------------------------|
| Workers | 6 parallel | **1** |
| Browser tabs | Many at once | **One tab** |
| Order | Random / parallel | **Fixed line-by-line** |
| Speed | Fast (~20s) | Slow (~2–5 min, watchable) |
| Purpose | CI regression | **Full walkthrough / demo QA** |

---

## Manual-only checklist (print & tick)

Use when you need 100% coverage including admin, mobile, and edge cases not yet in `sequential.spec.ts`.

1. [ ] UC-005 … UC-008 Landing extras  
2. [ ] UC-014 … UC-015 Menus  
3. [ ] UC-021 … UC-038 Editor tools  
4. [ ] UC-042 … UC-044 Public view extras  
5. [ ] UC-052 … UC-063 Compare deep  
6. [ ] UC-071 … UC-073 API playground send  
7. [ ] UC-085 … UC-091 Auth edge cases  
8. [ ] UC-102 … UC-113 Dashboard filters & trash  
9. [ ] UC-120 … UC-130 Owned document lifecycle  
10. [ ] UC-142 … UC-148 Settings save & keys  
11. [ ] UC-160 … UC-164 Admin (need admin user)  
12. [ ] UC-172 … UC-175 Palette & shortcuts  
13. [ ] UC-180 … UC-186 Full mobile pass  

---

**File index**

| File | Role |
|------|------|
| `docs/FRONTEND-USE-CASES.md` | This checklist |
| `frontend/e2e/sequential.spec.ts` | Single-tab automated walkthrough |
| `frontend/playwright.sequential.config.ts` | Slow, 1-worker config |
| `frontend/e2e/helpers/sequential.ts` | Step logger + pause |
| `TESTING.md` | Unit + smoke + viewport overview |
