# Project Features

This document summarizes the features currently implemented in **jsonbob** (frontend + Cloudflare Worker API), and the features that are pending or planned.

**Live**
- Web: https://jsonbob-web.abhinavmangal68.workers.dev  
- API: https://jsonbob-api.abhinavmangal68.workers.dev  

**Updated:** 2026-07-17

---

## Implemented Features

### 1. Authentication

- Login and registration (email / password)
- Google OAuth (when env configured)
- GitHub OAuth (when env configured)
- OAuth callback page (`/login/oauth`)
- Form validation on login and register
- Protected routes for library, settings, and admin
- Logout and JWT session persistence
- Access token refresh
- Bearer JWT and `jb_` API-key authentication

### 2. Local / Guest JSON Workspace

- Use the JSON editor without an account (`/documents/new`)
- Edit JSON as a guest
- Format, minify, sort keys, and validate JSON
- Save guest JSON anonymously via `POST /api/json` → public `/view/:id`
- Client recent-documents store (localStorage)
- Restore recent items after reload
- Templates gallery to start from sample shapes

### 3. Marketing & Landing

- Premium marketing home page with product copy
- Interactive Monaco hero animation
- Feature strip, FAQ accordion, and footer
- Primary CTAs: Open editor, View demo, Sign up
- Motion with `prefers-reduced-motion` support

### 4. Dashboard / Library

- Document library (`/dashboard`)
- Search documents (title + content preview)
- Filter by visibility, folder, tag, favorite
- Create-document shortcut
- Templates to start new documents
- Loading and empty states
- Analytics overview (counts, storage, recent)

### 5. Document Management

- Create documents with name, visibility, password, expiry, and initial JSON
- Open, edit, save, duplicate, and soft-delete documents
- Tags and favorites
- Server-side folders
- Trash list, restore, and purge
- Version history list and restore
- Document schema attach / update
- One-time burn share links
- Audit log of document actions

### 6. JSON Editor

- Monaco-based JSON editor
- JSON syntax highlighting
- Format and minify actions
- Live syntax validation
- Layout presets: Focus · Split · Review · Table
- Resizable panels
- Path breadcrumbs
- Intra-document split editor
- Drag-and-drop JSON / YAML import
- Format-on-paste preference
- Undo / redo (Monaco + toolbar / mobile chips)
- Editor minimap toggle
- Problems panel with Monaco markers
- Floating quick actions
- Status bar (line/col, size, collab)
- Large-JSON parse Web Worker
- Huge-JSON path flatten Web Worker
- Document tabs and pins in app chrome

### 7. JSON Tree Viewer

- Virtualized recursive object / array visualization
- Support for strings, numbers, booleans, null, and nested structures
- Type icons per node
- Context-menu actions (copy path, expand, edit, delete, duplicate)
- Array drag-and-drop reorder
- Tree search and copy JSONPath
- Expand / collapse with animation
- Invalid JSON error reporting

### 8. JSON Table Viewer

- Airtable-style table in the main workspace
- Sort and column filter
- Column resize and pin
- Pagination and bulk delete
- Edit and extract nested arrays / objects

### 9. Editor Side Panel & Tools

- Validation / Problems panel
- Tree and Table side modes
- Collapsible and resizable layout
- Responsive stacked mobile editor layout
- Full JSON tools drawer (25+ transforms):
  - Pretty / minify / sort
  - Case maps (snake, camel, Pascal…)
  - Flatten / unflatten
  - JSON ↔ CSV / YAML / XML / TOML / SQL / OpenAPI
  - JSON Patch / Merge Patch
  - Base64, JWT decode, URL, escape, UUID

### 10. Compare / Diff

- Dual-pane compare (`/compare`)
- Text / Tree / Table per side
- Sync scroll
- Diff list, next / previous navigation
- Diff minimap
- Merge path A↔B and accept-all actions
- Ignore whitespace, case, and key-order options
- Mobile compare cards (Version A / B)

### 11. Version History

- List saved document versions
- Display version timestamps
- Restore a previous version
- Schema and content snapshots stored server-side

### 12. Document Sharing

- Share sheet with visibility controls
- Public / private / password-protected documents
- Optional expiry
- Generate and copy share + raw API URLs
- Public viewer (`/view/:id`) with full workspace
- One-time burn links (`/ot/:token`)
- Per-document analytics in share UI
- Multi-SDK snippets (JS · cURL · Python · Go)

### 13. AI Assist

- AI assist panel in the editor
- `POST /ai/assist` via Cloudflare Workers AI (Llama) with local fallback
- Apply-fix into the editor

### 14. Real-time Collaboration

- Live collab toggle in the workspace
- Durable Object WebSocket rooms (`/collab/:roomId`)
- Presence bar (peer list)
- Last-write-wins content sync
- Durable collab comments
- BroadcastChannel fallback for same-origin tabs

### 15. Profile & Account Settings

- Display name and plan / quotas
- Edit profile name
- Change password (current + new)
- Membership / plan information
- Settings sections: Profile, Appearance, API Keys, OAuth, Organization, Audit

### 16. Appearance and Preferences

- Light, dark, and system themes
- Theme-aware Monaco editor
- Accent color options
- Format-on-paste preference
- Minimap preference
- Persistent UI preferences (client theme store)

### 17. Navigation and Responsive UI

- Desktop header navigation
- Desktop icon rail (⌘B expand)
- Document tabs bar
- Command palette (⌘K / Ctrl+K)
- Keyboard shortcuts modal
- Mobile bottom navigation
- Mobile FAB create menu
- Mobile home, editor, and compare layouts
- Bottom sheets for search / tools / AI
- Responsive document and editor layouts
- Design tokens (`--jb-*`) and Button / Dialog primitives
- Toast notifications and error boundary

### 18. Admin

- Admin dashboard (`/admin`, role-gated)
- Platform analytics
- User list and role changes (free / premium / admin)
- Document moderation (search / soft-delete)

### 19. Organizations & Enterprise

- Create and list organizations
- Org members API
- SCIM 2.0 user endpoints (`/scim/v2/Users`)
- Plans, quotas, and rate limiting

### 20. Developer Experience & API

- Production Cloudflare Workers API
- Anonymous JSONBlob-compatible API (`/api/json`, `/json/:id`)
- Authenticated documents REST API
- API keys CRUD
- API playground page (`/api-playground`)
- OpenAPI JSON + Swagger UI (`/api-docs`, `/api-docs/ui`)
- TanStack Query caching on the frontend
- Shared types between frontend and worker
- Health / ready probes
- CORS and secure headers
- R2 storage, D1 database, KV cache
- Queues + cron for expiry

### 21. Feedback and Error Handling

- Success and error toasts
- Inline editor error banners (e.g. Invalid JSON)
- Loading and empty states on library / settings
- Global React error boundary
- API error messages surfaced in UI

### 22. Accessibility

- Keyboard-accessible controls
- Command palette and shortcuts
- ARIA labels on primary navigation and key widgets
- Focus trap on dialogs / sheets
- Reduced-motion support
- Touch-friendly mobile targets

### 23. Testing & Quality

- Frontend unit tests (JSON tools, schema, path, diff, API base)
- Worker unit tests (sanitize JSON)
- Live smoke tests (raw + full API, 42 asserts)
- Playwright viewport E2E (desktop / tablet / mobile)
- Playwright browser flow E2E (landing, editor, compare, auth, mobile FAB)
- Lint, typecheck, and production build gates
- Root `npm run test:all`

---

## Pending or Incomplete Features

1. Demo / one-click guest login button (guest editor exists; no dedicated “demo user” login)
2. Document **description** field separate from name (name + visibility exist; description metadata is limited)
3. Classic paginated “all documents” page with explicit page controls (library uses search/filters; pagination UX can deepen)
4. Unsaved-change warning on **internal** route navigation (browser reload warning / Monaco dirty state can deepen)
5. Configurable tab size and word-wrap exposed as first-class Settings controls (Monaco defaults exist; more prefs can be added)
6. Highlighted visual diff between a historical version and current content inside Versions UI
7. Compare **any two** selected historical versions (current compare is A/B workspace; not version-picker based)
8. Autosave (manual Save is primary today)
9. Return users to the originally requested URL after login (today redirects to login / dashboard flows)
10. Password **reset via email** (password **change** while logged in exists)
11. Account deletion / self-serve account wipe
12. Rich org **member management UI** (API exists; Settings org UI is basic)
13. Full SCIM enterprise hardening (token auth, full User/Group lifecycle beyond current stub)
14. Theme preference stored on the **server account** (theme is client-persisted today)
15. Functional version-history panel inside the **public** share viewer (owned docs have versions)
16. Dedicated custom branded 404 / route-error marketing pages (unknown routes redirect home)
17. Skip-to-content link and full WCAG 2.2 AA formal audit sign-off
18. Cross-browser verification matrix (Chrome covered heavily; Safari / Firefox formal pass pending)
19. Final production performance budget report (Lighthouse / Core Web Vitals tracked separately)
20. Deeper Playwright coverage for every Settings / Admin / Share edge case

---

## Planned Future Features

1. JSON Schema **library** browser per document (beyond attach + validate)
2. JSON Schema **form-based** editing (generate forms from schema)
3. Richer team workspaces with invitations and roles UI
4. Expanded organization roles and permissions matrix
5. Conflict-aware OT / CRDT collaborative editing (beyond LWW)
6. Richer audit-log explorer with filters and export
7. Plugin and extension system
8. Billing / Stripe upgrade for premium plans
9. Email notifications (share, expiry, security)
10. Offline-first PWA sync
11. Desktop install packaging beyond PWA manifest
12. Multi-language / i18n UI
13. Advanced search (path queries, regex across docs)
14. Webhooks for document events
15. SSO beyond Google / GitHub (SAML / OIDC IdP)

---

## Feature Summary

| Category | Status |
|----------|--------|
| Auth (email + OAuth) | Implemented |
| Guest editor | Implemented |
| Marketing landing | Implemented |
| Dashboard / library | Implemented |
| Document CRUD + trash + folders + tags | Implemented |
| Monaco editor + tree + table + tools | Implemented |
| Compare / diff / merge | Implemented |
| Sharing + one-time links | Implemented |
| Versions | Implemented |
| AI assist | Implemented |
| Live collaboration | Implemented |
| Settings / profile / API keys | Implemented |
| Admin + orgs + SCIM (base) | Implemented |
| Production Cloudflare API | Implemented |
| Automated tests (unit + smoke + E2E) | Implemented |
| Email password reset / account delete | Pending |
| Formal WCAG 2.2 AA audit | Pending |
| Plugins / billing / SAML | Planned |

---

## How to verify in the browser

```bash
cd /home/abhinav/Videos/MyProjects/jsonbob

# Watch interactive UI tests
PLAYWRIGHT_BASE_URL=https://jsonbob-web.abhinavmangal68.workers.dev \
  npm run test:e2e --prefix frontend -- --ui --project=desktop-chrome

# Or run everything
npm run test:all
```

---

**Bottom line:** Core product features for editing, comparing, sharing, auth, AI, collab, library, API, mobile, and admin are **implemented**. Remaining items are polish, enterprise depth, compliance audits, and future platform expansions listed above.
