# jsonbob — Session Work Log (15 Jul 2026)

Complete record of what was built, fixed, and deployed for **jsonbob** (JSONBlob-style editor on Cloudflare).

---

## Live URLs

| App | URL |
|-----|-----|
| **Frontend** | https://jsonbob-web.abhinavmangal68.workers.dev |
| **API** | https://jsonbob-api.abhinavmangal68.workers.dev |
| Editor | https://jsonbob-web.abhinavmangal68.workers.dev/documents/new |
| Compare | https://jsonbob-web.abhinavmangal68.workers.dev/compare |
| Raw JSON example | `https://jsonbob-api.abhinavmangal68.workers.dev/json/{id}` |
| Share view | `https://jsonbob-web.abhinavmangal68.workers.dev/view/{id}` |

---

## 1. Tree view toggle → then jsonblob-style layout

### What you wanted
- One tree icon to show/hide tree
- Later: match [jsonblob.com](https://jsonblob.com) — sample JSON + editor + tree side by side for everyone (including logged-in users)

### What we did
- **`JsonWorkspace.tsx`**: editor toolbar tree icon; `showTree` state (now **default `true`**)
- Tree panel opens beside the editor; icon highlights when active
- **`CreateJsonPage.tsx`**: restored **`SAMPLE_JSON`** for all users (including logged-in), not empty `{}`

### Key files
- `frontend/src/components/editor/JsonWorkspace.tsx`
- `frontend/src/pages/CreateJsonPage.tsx`
- `frontend/src/components/editor/jsonTools.ts` (`SAMPLE_JSON`)

---

## 2. Deploy backend + frontend (separate domains)

### Architecture
- **Worker API** → `jsonbob-api` → `*.workers.dev` API host  
- **Frontend** → static assets Worker `jsonbob-web` (Pages create failed on account; Workers assets used instead)

### Cloudflare resources created
- D1: `jsonbob-db` (`1fc3d594-7fe9-4edf-8407-7ffbc9c56842`)
- R2: `jsonbob-documents`
- KV: reused existing `CACHE`, `SESSIONS`
- Queues: `jsonbob-expire`, `jsonbob-analytics`
- Account ID corrected to logged-in account: `88ed6e11baf2c8920c6e3609c8004635`

### Config / secrets
- `worker/wrangler.jsonc` — real binding IDs + prod vars:
  - `APP_URL` = frontend URL  
  - `API_URL` = API URL  
- Secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- D1 migration applied remote
- Frontend build: `VITE_API_BASE_URL=https://jsonbob-api.abhinavmangal68.workers.dev`
- `frontend/wrangler.jsonc` — SPA assets deploy

### How domains work
Cloudflare assigns:
- `{worker-name}.{account-subdomain}.workers.dev`
- Custom domains can be added later via `routes` + `custom_domain: true`

### Key files
- `worker/wrangler.jsonc`
- `frontend/wrangler.jsonc`
- `.github/workflows/deploy-frontend.yml` (points at Worker deploy + `VITE_API_BASE_URL`)

---

## 3. Logged-in user: JSON / URLs “not coming properly”

### Root cause
For logged-in document pages, **Copy URL / Raw** pointed at the **frontend** `/json/:id`, which returns the SPA HTML, not JSON.

### Fixes
| Action | Before | After |
|--------|--------|--------|
| Share URL | `{APP}/json/{id}` (HTML) | `{APP}/view/{id}` |
| API / Raw URL | frontend `/json/...` | `{API}/json/{id}` |
| Auth refresh | `POST /auth/refresh` on frontend | `POST {VITE_API_BASE_URL}/auth/refresh` |
| Public view save/copy | relative `/json` | uses API client + correct URLs |

### Key files
- `worker/src/services/documents.ts` (`url`, `apiUrl` in create + `mapDocumentSummary`)
- `frontend/src/pages/DocumentDetailsPage.tsx`
- `frontend/src/pages/PublicJsonPage.tsx`
- `frontend/src/api/client.ts`

---

## 4. Compare feature (like JSON Editor Online)

Upgraded **Compare** to a dual-pane workspace.

### Features added
- **Modes per side:** Text · Tree · Table  
- **Center rail:** Copy ←/→ · Transform ⇇/⇉ · Compare checkbox · ↑/↓ diffs  
- **Diff highlighting** on tree nodes (colors by change type)  
- **Diff list** + stats (missing A/B, value/type changes)  
- **Table mode:** if root isn’t tabular → list nested arrays with **Edit** / **Extract** / Switch to tree  
- **Edit:** focus nested array as table  
- **Extract:** replace document with that subtree  
- **Transform menu:** pretty · minify · sort keys · UPPERCASE keys  
- Sample data includes `paymentGateways.payCards` for table demos  

### Key files
- `frontend/src/pages/CompareJsonPage.tsx`
- `frontend/src/components/editor/JsonTableView.tsx`
- `frontend/src/components/editor/JsonTreeView.tsx` (highlight classes, focus scroll)
- `frontend/src/lib/jsonDiff.ts` (existing)
- `frontend/src/lib/jsonPath.ts` (new: get/set path, table helpers)

---

## 5. Settings + Help menus (header)

Like JSON Editor Online’s header dropdowns.

### Settings ▾
- Theme: Browser default / Light / Dark  
- Theme color: Orange · Green · Blue · Red  
- Configure account (or sign-in link)  
- Open Compare  

### Help ▾
- About · API Docs · FAQ · Product tour · Feedback  
- Open Editor / Compare  

### Theme system
- Extended `themeStore`: `mode`, `accent`, resolved `dark`
- CSS vars: `--jb-accent`, `--jb-accent-deep`, `--jb-accent-soft`
- Monaco editor follows light/dark
- Logo + primary buttons use accent

### Key files
- `frontend/src/components/layout/SettingsHelpMenus.tsx`
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/store/themeStore.ts`
- `frontend/src/index.css`
- `frontend/src/App.tsx` (`ThemeBoot` + system preference listener)
- `frontend/src/components/editor/JsonEditor.tsx`

---

## 6. Project layout (relevant parts)

```text
jsonbob/
├── frontend/                 # React + Vite + Tailwind + Monaco
│   ├── wrangler.jsonc        # Static assets Worker (SPA)
│   ├── src/
│   │   ├── api/              # Axios client (VITE_API_BASE_URL)
│   │   ├── components/
│   │   │   ├── editor/       # Workspace, Tree, Table, Editor
│   │   │   └── layout/       # AppShell, SettingsHelpMenus
│   │   ├── lib/              # jsonDiff, jsonPath
│   │   ├── pages/            # Create, Details, Compare, …
│   │   └── store/            # auth, theme, recent
│   └── …
├── worker/                   # Hono API on Cloudflare Workers
│   ├── wrangler.jsonc
│   ├── migrations/
│   └── src/
│       ├── routes/
│       ├── services/         # documents, users, queues, …
│       └── …
└── .github/workflows/        # CI + deploy
```

---

## 7. Environment variables

### Frontend (build-time)
```bash
VITE_API_BASE_URL=https://jsonbob-api.abhinavmangal68.workers.dev
```
Empty locally → Vite proxies to `http://127.0.0.1:8787`.

### Worker (`wrangler.jsonc` vars)
```jsonc
"APP_URL": "https://jsonbob-web.abhinavmangal68.workers.dev",
"API_URL": "https://jsonbob-api.abhinavmangal68.workers.dev"
```

### Worker secrets
```bash
npx wrangler secret put JWT_ACCESS_SECRET
npx wrangler secret put JWT_REFRESH_SECRET
```

---

## 8. Deploy commands (reference)

```bash
# API
cd worker
npx wrangler d1 migrations apply jsonbob-db --remote
npx wrangler deploy

# Frontend
cd frontend
VITE_API_BASE_URL=https://jsonbob-api.abhinavmangal68.workers.dev npm run build
npx wrangler deploy
```

---

## 9. Custom domains (when you have a domain)

Example: `jsonbob.com` + `api.jsonbob.com`

1. Put domain on same Cloudflare account  
2. Worker API `wrangler.jsonc`:
   ```jsonc
   "routes": [{ "pattern": "api.yourdomain.com", "custom_domain": true }],
   "vars": {
     "APP_URL": "https://yourdomain.com",
     "API_URL": "https://api.yourdomain.com"
   }
   ```
3. Frontend Worker: custom domain `yourdomain.com` (dashboard or routes)  
4. Rebuild frontend with `VITE_API_BASE_URL=https://api.yourdomain.com`  
5. Redeploy both  

---

## 10. Ops / deploy notes

- Apply D1: `npx wrangler d1 migrations apply jsonbob-db --remote` (includes `0002_folders_ot_google`)  
- Secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional until OAuth needed)  
- Worker ships with `AI` + `COLLAB_ROOM` Durable Object binding  

---

## 11. Closeout sprint — production hardening

| Area | Detail |
|------|--------|
| **Workers AI** | `POST /ai/assist` · Llama 3.1 · local fallback |
| **Google OAuth** | `/auth/google` + callback → `/login/oauth` |
| **Collab DO** | `CollabRoom` WebSocket · presence + LWW content sync |
| **Folders** | `document_folders` · `PUT /documents/:id/folder` |
| **One-time burn** | `POST /documents/:id/one-time` · `GET /ot/:token` |

### Key files
- `worker/src/durable-objects/CollabRoom.ts`
- `worker/src/routes/ai.ts` · `services/googleAuth.ts` · `services/foldersOt.ts`
- `worker/migrations/0002_folders_ot_google.sql`
- `worker/wrangler.jsonc` (ai + durable_objects)
- `frontend/src/features/ai/AiAssistPanel.tsx`
- `frontend/src/features/collab/CollabPresenceBar.tsx`
- `frontend/src/pages/OAuthCallbackPage.tsx`

### Docs
- [FEATURE-COMPLETE.md](./FEATURE-COMPLETE.md) — **~98%**

---

## 12. Smoke checklist (hardening)

1. AI panel → `source: workers-ai` or local-fallback  
2. Login → Continue with Google (if secrets set)  
3. Editor → Live collab → peers / content sync  
4. Share → server one-time link burns via `/ot/:token`  
5. Library folder assign via API  

---

*jsonbob implementation session — 15 Jul 2026.*
