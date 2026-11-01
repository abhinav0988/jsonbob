# Autonomous Senior QA Engineer — Prompt (jsonbob)

Use this prompt to drive continuous QA until the app is production-ready.

---

You are my autonomous Senior QA Engineer for **jsonbob**.

Goal:
Continuously improve this application until it is production-ready.

Workflow:

1. Start the development server if it is not already running.
2. Open Google Chrome on my desktop (NOT headless).
3. Navigate to the local application.
4. Crawl every accessible page.
5. Discover every route automatically.
6. Click every button, menu, tab, card, and navigation item.
7. Fill every form with both valid and invalid data.
8. Test login, registration, dashboard, profile, settings, editor, compare, share, and all authenticated flows.
9. Test responsive layouts at mobile, tablet, and desktop sizes.
10. Monitor:
    - Console errors
    - Network failures
    - JavaScript exceptions
    - API failures
11. If a failure is found:
    - Determine the root cause.
    - Edit the source code.
    - Save the changes.
    - Restart the application if needed.
    - Refresh Chrome.
    - Re-run the failed scenario.
12. Continue testing until no critical issues remain.

Rules:
- Never ask for confirmation.
- Never stop after finding a bug.
- Continue fixing and retesting until all scenarios pass.
- Produce a final report with all fixes and remaining issues.

---

## jsonbob — run commands

**Always `cd` into the project first:**

```bash
cd /home/abhinav/Videos/MyProjects/jsonbob
```

### One-time setup

```bash
npm install --prefix worker
npm install --prefix frontend
cd frontend && npx playwright install chromium && cd ..
```

### Local dev servers

| Piece | Command |
|-------|---------|
| API (Worker) | `npm run dev:worker` → http://127.0.0.1:8787 |
| Web (Vite) | `npm run dev:frontend` → http://localhost:5173 |

Run both in separate terminals.

### Automated testing (from repo root)

| Test | Command |
|------|---------|
| **Everything** | `npm run test:all` |
| Unit only | `npm test --prefix frontend && npm test --prefix worker` |
| Live smoke (prod API) | `npm run test:smoke` |
| Viewport E2E | `npm run test:views --prefix frontend` |
| Browser flows (live) | see below |

### Sequential line-by-line (one tab — recommended for you)

Full use-case list: **`docs/FRONTEND-USE-CASES.md`** (129 cases)

```bash
cd /home/abhinav/Videos/MyProjects/jsonbob

# Watch in Chrome — one tab, slow, step-by-step (not random fast tabs)
PLAYWRIGHT_HEADED=1 PLAYWRIGHT_SLOW_MO=600 \
  npm run test:e2e:sequential --prefix frontend

# Live site
PLAYWRIGHT_BASE_URL=https://jsonbob-web.appsphere.workers.dev \
  PLAYWRIGHT_HEADED=1 \
  npm run test:e2e:sequential --prefix frontend
```

### Fast parallel E2E (CI style — opens many tabs quickly)

Against **live deploy**:

```bash
cd /home/abhinav/Videos/MyProjects/jsonbob

PLAYWRIGHT_BASE_URL=https://jsonbob-web.appsphere.workers.dev \
  npm run test:e2e --prefix frontend -- e2e/flows.spec.ts --headed --workers=1
```

Against **local build** (preview auto-starts):

```bash
cd /home/abhinav/Videos/MyProjects/jsonbob

npm run build --prefix frontend
npm run test:e2e --prefix frontend -- e2e/flows.spec.ts --headed --workers=1
```

Interactive UI picker:

```bash
cd /home/abhinav/Videos/MyProjects/jsonbob

PLAYWRIGHT_BASE_URL=https://jsonbob-web.appsphere.workers.dev \
  npm run test:e2e --prefix frontend -- --ui --project=desktop-chrome
```

### Live URLs

| | URL |
|--|-----|
| Web | https://jsonbob-web.appsphere.workers.dev |
| API | https://jsonbob-api.appsphere.workers.dev |

### Spec files

| File | What it tests |
|------|----------------|
| `frontend/e2e/flows.spec.ts` | Real clicks: landing, editor, compare, auth, mobile FAB |
| `frontend/e2e/viewports.spec.ts` | Desktop / tablet / mobile layout |
| `frontend/scripts/smoke-full.mjs` | 42 live API asserts |
| `TESTING.md` | Full testing guide |

### Common mistakes

| Error | Fix |
|-------|-----|
| `Missing script: "test:all"` | You are not in the project folder — run `cd /home/abhinav/Videos/MyProjects/jsonbob` first |
| `ENOENT .../frontend/package.json` | Same — `--prefix frontend` is relative to cwd |
| `Executable doesn't exist` (Playwright) | Run `cd frontend && npx playwright install chromium` |
| `Permission denied` on `.md` file | Markdown is not a script — use `cat file.md` or open in editor |
