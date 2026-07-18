# jsonbob — Complete Product Redesign Brief

**Role:** Senior Staff Product Design + Frontend Architecture  
**Goal:** Transform jsonbob from a capable MVP into the **world’s best online JSON editor** — the Linear/Stripe/Raycast of JSON tooling.  
**Date:** 2026-07-15  
**Stack:** React · TypeScript · Tailwind · Monaco · Cloudflare Workers · D1 · R2 · Hono · Vite  

**Companion docs**
- [CODE-REVIEW.md](./CODE-REVIEW.md) — engineering audit  
- [FEATURE-COMPLETE.md](./FEATURE-COMPLETE.md) — feature matrix vs vision  
- [DOCS-SESSION-COMPLETE.md](./DOCS-SESSION-COMPLETE.md) — what shipped in the build session  

---

## 1. Product audit

### What exists today
jsonbob is a **Cloudflare-native JSON store + editor**:
- Monaco JSON editing with tree, path explorer, compare, share, versions  
- Auth (JWT), plans/quotas, password/expiry docs, admin, analytics  
- Public API `/json/:id` (JSONBlob-compat)  
- Theme mode + accent colors  

### Positioning gap
| Today | Target |
|-------|--------|
| “JSONBlob clone that works” | “The JSON IDE for professionals” |
| Feature checklist | Opinionated workflow product |
| Dark panels + orange accents | Design system as product identity |
| Tools scattered | Command-palette-first OS |

### Competitive context
- **JSONBlob** — storage + share; editor UX dated  
- **JSON Editor Online** — feature-rich but visually busy; ads  
- **jq / API clients** — power, no storage UX  
- **VS Code / JetBrains** — huge JSON files; not cloud-native share  

**Winning wedge:** *Cloudflare-fast storage + IDE-grade editing + Raycast-speed commands + enterprise share/ACL.*

### Product principles
1. **JSON is the product** — UI disappears around the data  
2. **Keyboard beats mouse** — every action has a command  
3. **Speed is a feature** — 100MB JSON must feel alive  
4. **Trust** — share links, permissions, history must feel Stripe-grade  
5. **One motion language** — subtle, never carnival  

---

## 2. UX audit

### Strengths
- Clear primary loop: paste → save → URL  
- Compare is already differentiated  
- Tree/table/path ideas exist  
- Deployed dual-origin API/FE works  

### Pain points
1. **Landing does not sell the product** — generic SaaS copy, weak brand gravity  
2. **Editor chrome competes with content** — toolbars, labels, uppercase microheaders  
3. **Discoverability** — Transform/Edit/Extract buried; no command palette  
4. **Inconsistency** — Table lives on Compare only, not main workspace  
5. **No spatial memory** — no tabs, presets, pinned docs, breadcrumbs  
6. **Diff UX is list-first** — not a professional sync-scrolled diff  
7. **Settings split** — header dropdown vs `/settings` account page feel unrelated  
8. **Empty states** — rare; samples hard-coded rather than template gallery  

### Mental model (target)
```
Workspace
  └── Documents (tabs / recent / pins)
        └── Views: Text | Tree | Table | Diff
        └── Tools: via ⌘K / panel
        └── Share / API / History: right rail
```

---

## 3. UI audit

### Visual debt
- Hardcoded slate/orange hex everywhere (`#0b1220`, `#f97316`) vs tokens  
- Mixed “jb-action” utility class + Tailwind utilities; uneven density  
- Header is utilitarian; landing lacks composition  
- No elevation scale; panels share identical #111827 fills  
- Tree indentation fine; no iconography system  
- Motions: none (no Framer Motion / CSS transition language)  

### What “expensive” means here
- **1 primary accent** per theme, used sparingly  
- **Hairline borders** + soft ambient shadows on elevated surfaces only  
- **Monospace for data**, sans for chrome  
- **40–48px command bar** vs stacked toolbars  
- **Quiet empty states** with one CTA  

### Inspiration mapping
| Product | Steal |
|---------|--------|
| Linear | Density, keyboard, issue-like docs |
| Raycast | ⌘K as OS |
| Stripe | Trust, type, diagrams |
| Vercel | Marketing + product polish continuum |
| Notion | Blocks, soft hierarchy |
| GitHub | Diff/history language |
| Warp / Arc | Craft density without clutter |

---

## 4. Missing features (priority-ranked)

### P0 — Product cannot win without these
- Command palette (⌘K / Ctrl+K)  
- Unified workspace (Text + Tree + Table + Problems)  
- Virtualized tree (huge JSON)  
- Professional diff (sync scroll, jump, merge)  
- Problems panel (parse + schema)  
- Global search (docs + nodes)  
- Design token system + light mode that actually works everywhere  

### P1 — Category differentiation
- JSON Schema validation  
- Tools cabinet (flatten, CSV, YAML, JWT, Base64…)  
- Document organization (folders, tags, favorites, trash)  
- Templates + paste detect  
- Share modal (expiry, password, one-time, analytics)  
- Keyboard shortcut map  

### P2 — Moats
- AI assistant (explain / schema / TS / fix)  
- Realtime collab (Durable Objects)  
- API playground + SDK snippets  
- Presence, comments  
- Web Worker JSON parse for 50MB+  

### P3 — Enterprise
- SSO / OAuth (Google column exists unused)  
- API keys (table exists unused)  
- Audit log, org workspaces  
- SCIM / SOC2 narrative assets  

---

## 5. Information architecture

```
Landing (/)
Auth (/login, /register)
App Shell
├── Home / Library          # recent, favorites, folders
├── Editor /:id | /new      # primary workspace
├── Compare                 # dual doc / import from library
├── Tools                   # toolbox (can open as drawer anywhere)
├── API                     # explorer + playground
├── Settings                # modal: appearance, editor, account…
└── Admin (role=admin)
Overlays
├── Command Palette ⌘K
├── Share Sheet
├── AI Panel
└── Shortcuts ⌘/
```

**Delete conceptually:** separate “Path Explorer mode” → becomes Tree search + path copy.  
**Elevate:** Compare as first-class peer of Editor, not sidebar afterthought.

---

## 6. Navigation redesign

### Marketing shell
- Logo (hero-grade wordmark) · Product · Pricing · Docs · Sign in · CTA **Open editor**

### App shell
```
┌ Left rail (56–64px icons, expand on hover / ⌘B)
│  Library · Editor · Compare · Tools · API · Settings
├ Top: breadcrumbs · document title · share · avatar
└ Main: workspace
```

### Document chrome
- Tab strip (pinned + recent)  
- Layout presets: Focus · Split · Review · Table  

---

## 7. Wireframes (Figma-style descriptions)

### W1 — Landing hero
```
[ ambient grid + soft gradient ]
jsonbob                          [Open editor] [Sign in]

The JSON IDE for the edge.

[ Interactive Monaco mini · auto-typing sample ]
           ↓ spring into live preview

[ Feature strip: Edit · Diff · Share · API ]
```

### W2 — Editor workspace
```
[tabs] payment.json ×  schema.json ×  +
[⌘K search commands…]          [Share] [•••]

┌ Text 70% ───┬ Tree 30% ──┐  or resizable
│ Monaco     │ Explorer   │
│            │ breadcrumbs│
├ Problems ────────────────┤
│ 2 errors · Jump          │
└ status: Ln 42 Col 8 · Valid · 1.2MB · UTF-8 ┘
```

### W3 — Compare
```
Doc A [tabs]     │ sync │     Doc B [tabs]
Text|Tree|Table  │ jump │     Text|Tree|Table
─────────────────┼──────┼─────────────────
[diff minimap]   │ ←→  │   highlights
                 │ merge│
Stats: +12 −4 ~9 │      │
```

### W4 — Command palette
```
⌘K ________________________________
> format document
  minify
  compare with…
  share…
  theme dark
```

### W5 — Library
```
Folders | Tags | Recents
[cards / list toggle]
filters: private · public · expired
```

---

## 8. Component hierarchy

```
AppProviders (Query, Theme, Auth, Toast, Command)
├── MarketingLayout
│   └── Landing sections…
├── AppLayout
│   ├── AppRail
│   ├── AppTopBar
│   ├── CommandPalette
│   └── <Outlet>
│        ├── LibraryPage
│        ├── EditorPage
│        │    ├── DocumentTabs
│        │    ├── WorkspaceLayout (resizable panels)
│        │    │    ├── TextPane (Monaco)
│        │    │    ├── TreePane
│        │    │    ├── TablePane
│        │    │    └── ProblemsPane
│        │    ├── StatusBar
│        │    └── ShareSheet
│        ├── ComparePage
│        ├── ToolsPage / ToolsDrawer
│        ├── ApiExplorerPage
│        └── SettingsModal
└── Primitive kit: Button, IconButton, Input, Select,
    Dropdown, Popover, Tooltip, Dialog, Tabs, Badge,
    Toast, Skeleton, Panel, Resizable, Tree, DataTable
```

---

## 9. Design system — “Bob OS”

### Philosophy
**Quiet chrome. Loud data.** Surfaces are nearly flat; interaction states carry the personality.

### Foundations
| Token layer | Purpose |
|-------------|---------|
| `color.*` | Semantic + accent |
| `space.*` | 4px base |
| `radius.*` | sm/md/lg only |
| `shadow.*` | 3 elevations |
| `motion.*` | duration/easing |
| `type.*` | display/body/mono |

### Component API rule
Every interactive control supports `size`, `intent`, `disabled`, and keyboard focus ring `ring-2 ring-[accent]/40`.

---

## 10. Color system

### Dark (default)
```
bg.canvas      #09090b
bg.panel       #0c0c0f
bg.elevated    #141418
border.subtle  #27272a
border.strong  #3f3f46
text.primary   #fafafa
text.secondary #a1a1aa
text.muted     #71717a
accent         #f97316  (or user accent)
success        #22c55e
warning        #eab308
danger         #ef4444
info           #38bdf8
diff.add.bg    rgba(34,197,94,.12)
diff.del.bg    rgba(239,68,68,.12)
diff.chg.bg    rgba(249,115,22,.12)
```

### Light
```
bg.canvas      #fafafa
bg.panel       #ffffff
bg.elevated    #ffffff
border.subtle  #e4e4e7
text.primary   #09090b
text.secondary #52525b
accent         same family, slightly deeper for contrast
```

### Gradients (marketing only)
- Hero: `radial-gradient(60% 50% at 50% 0%, accent/20, transparent)`  
- Never gradient buttons in app chrome  

---

## 11. Typography scale

| Role | Font | Size / LH / Weight |
|------|------|---------------------|
| Display | Geist / Inter | 56/64/600 → 40/48 mobile |
| Title | Inter | 24/32/600 |
| Body | Inter | 14/22/400 |
| UI | Inter | 13/18/500 |
| Micro | Inter | 11/14/500 · tracking wide |
| Code | JetBrains Mono / Geist Mono | 13/20/400 |

**Rule:** One display face on marketing; product UI = Inter + Mono only.

---

## 12. Spacing scale

```
0 1 2 3 4 5 6 8 10 12 16 20 24 32 40 48 64
```
- Panel padding: **16**  
- Toolbar height: **40**  
- Rail width: **56** collapsed / **220** expanded  
- Dialog padding: **24**  
- Stack gap default: **8**  

---

## 13. Icon system

- **Library:** Lucide (consistent 1.5 stroke)  
- Sizes: 14 (inline), 16 (toolbar), 20 (rail)  
- Tree: folder/object/array/string/number/boolean/null glyphs  
- Diff: plus / minus / tilde / move  

Never mix emoji into chrome (✓ already used lightly — migrate to icons).

---

## 14. Animation specification

**Library:** Framer Motion + CSS for cheap hover  

| Token | Value |
|-------|--------|
| `duration.fast` | 120ms |
| `duration.normal` | 180ms |
| `duration.slow` | 280ms |
| `ease.out` | `[0.16, 1, 0.3, 1]` |
| `ease.inOut` | `[0.65, 0, 0.35, 1]` |

### Allowed
- Panel expand height/opacity  
- Palette spring enter (`y: 8 → 0`, opacity)  
- Tree row stagger ≤ 20 items; after that instant  
- Button press scale `0.98`  

### Forbidden
- Parallax marketing beyond subtle  
- Continuous glow pulses  
- Layout thrash on every keystroke  

`prefers-reduced-motion: reduce` → opacity only.

---

## 15. Responsive layouts

| Breakpoint | Behavior |
|------------|----------|
| < 768 | Single column; bottom sheet tools; rail → tab bar |
| 768–1200 | Editor + one side pane; Compare stacked |
| > 1200 | Full split; optional third problems dock |
| > 1600 | Comfortable max width 1600–1800 for library |

Touch: 44px hit targets on mobile chrome only — desktop remains dense.

---

## 16. Implementation roadmap

### Phase 0 — Foundation (2 weeks)
- Design tokens in CSS + Tailwind theme  
- Primitive components  
- Command palette shell  
- App rail + layout shell  
- Fix light theme across editor surfaces  

### Phase 1 — Editor OS (3–4 weeks)
- Resizable panels (`react-resizable-panels`)  
- Document tabs + recent/pins (local then API)  
- Problems panel + Monaco markers  
- Virtualized tree (`@tanstack/react-virtual`)  
- Status bar upgrade  
- Paste detection + auto-format option  

### Phase 2 — Diff + Table (3 weeks)
- Sync-scroll diff viewer  
- Merge left/right hunk  
- Airtable-grade table (sort/filter/resize/pin)  
- CSV export  

### Phase 3 — Tools + Schema (3 weeks)
- Tools drawer (20 converters)  
- Schema attach + validate  
- Flatten/unflatten, Patch  

### Phase 4 — Platform (4 weeks)
- Folders/tags/trash API  
- Share sheet polish  
- API playground  
- API keys + Google OAuth (schema ready)  

### Phase 5 — AI + Collab (ongoing)
- AI side panel (Workers AI or external)  
- Durable Object rooms for presence  
- Comments  

---

## 17. React component architecture

```
src/
  app/                 # routes, providers
  design-system/       # tokens, primitives
  features/
    command-palette/
    editor/
    tree/
    table/
    compare/
    library/
    share/
    tools/
    ai/
    settings/
  entities/            # document, user types + API hooks
  shared/              # hooks, lib, ui helpers
```

**State**
- Server: TanStack Query  
- Client UI: Zustand slices (`ui`, `workspace`, `palette`)  
- Auth/theme: existing persisted stores  

**Editor performance**
- Parse JSON in Worker for > 2MB  
- Tree virtualization by visible range  
- Debounced validation  

---

## 18. Folder structure (target)

```
frontend/src/
├── app/
│   ├── App.tsx
│   ├── routes.tsx
│   └── providers.tsx
├── design-system/
│   ├── tokens.css
│   ├── typography.ts
│   └── components/{Button,Dialog,Tabs,…}
├── features/
│   ├── editor/
│   ├── compare/
│   ├── library/
│   ├── command-palette/
│   ├── tools/
│   ├── share/
│   └── settings/
├── entities/
│   ├── document/
│   └── user/
└── shared/
    ├── api/
    ├── lib/
    └── hooks/
```

Keep `worker/` as is; add `/v1` alias later without breaking `/json/:id`.

---

## 19. Tailwind implementation plan

1. Map tokens → `@theme` in CSS (Tailwind v4)  
2. Replace hardcoded hex gradually via lint rule / codemod  
3. Utility layers:
   - `bg-canvas`, `bg-panel`, `text-muted`, `border-subtle`  
4. Component variants with `cva` (class-variance-authority)  
5. Dark via `class="dark"` already present — extend light panel classes  
6. Motion: `motion-safe:` variants  

Do **not** introduce a heavy UI kit; compose primitives.

---

## 20. Premium UI prompts (per screen)

Use these with a designer or image/codegen agent.

### Landing
> Dark canvas, soft radial accent glow top-center, oversized “jsonbob” wordmark (Geist), one line headline under 40 chars, live Monaco snippet animating typed JSON, no cards in hero, single primary CTA “Open editor”, secondary ghost “View demo”. Stripe×Vercel marketing restraint.

### Editor
> Dense Linear-like IDE: thin tab strip, 40px command toolbar with icons only + tooltips, resizable Monaco + VS Code style tree with Lucide type icons, bottom problems drawer, status bar with muted mono metrics. Accent used only on active tab indicator and primary share button.

### Compare
> GitHub PR diff energy: two panes, center slim control column, difference minimap, green/red/orange hunk rails, synchronized scroll, merge chevrons. No ad chrome. Professional.

### Command palette
> Raycast center modal 640px, blur backdrop 8px, list rows 36px, category hints right-aligned muted, fuzzy highlight accent.

### Library
> Notion database list: left folders, main table of documents with tags pills, empty state soft illustration not emoji clusters.

### Settings modal
> Stripe settings: left sections list, right form, generous 24 padding, no walls of cards.

### Share sheet
> Single column: link field + copy, visibility segmented control, expiry, password, analytics strip. Feels like Vercel deploy URL dialog.

---

## Success metrics

| Metric | Baseline | Target (6 mo) |
|--------|----------|----------------|
| Time to first save | unknown | < 20s new user |
| ⌘K usage | 0 | > 40% sessions |
| Docs opened > 1MB | crash/jank | smooth tree scroll |
| Compare completion | hobby | weekly active share of power users |
| NPS / qualitative | “like JSONBlob” | “replaced my editor for JSON” |

---

## Closing principle

Ship the **Editor OS** (palette + panels + virtual tree + problems) before AI or marketing polish. Beauty without leverage is decoration; leverage without beauty is another JSON Blob.

**jsonbob wins when developers feel faster thinking in JSON.**
