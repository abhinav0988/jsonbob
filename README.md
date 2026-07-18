# JSONBob

JSON storage platform (JSONBlob-like) on a **Cloudflare-only** data plane: Workers + D1 + R2 + KV + Queues.

See [PROJECT_PLAN.md](./PROJECT_PLAN.md) for full architecture.

## Features (MVP complete)

- Anonymous `POST /api/json` → public `GET /json/:id`
- Auth: register / login / logout / refresh (JWT + KV sessions)
- Documents: CRUD, duplicate, download, password, expiry, versions + restore
- Dashboard analytics (storage, requests, quotas)
- Admin dashboard (users, roles, force-delete)
- Rate limiting (KV), plan quotas (free / premium / admin)
- Expire + analytics Cloudflare Queues + cron scan every 15 minutes
- OpenAPI at `/api-docs` and Swagger UI at `/api-docs/ui`
- CI + deploy GitHub Actions for Worker and Pages

## Quick start

```bash
npm install --prefix worker
npm install --prefix frontend

# Local D1 migrations
npm run db:migrate:local

# Terminal 1 — API http://localhost:8787
npm run dev:worker

# Terminal 2 — UI http://localhost:5173
npm run dev:frontend
```

Worker secrets: `worker/.dev.vars`

```bash
# Promote a user to admin (local D1)
cd worker
npx wrangler d1 execute jsonbob-db --local --command \
  "UPDATE users SET role='admin' WHERE email='you@example.com';
UPDATE user_plans SET role='admin', storage_quota_bytes=10737418240, document_quota=100000, api_rate_per_minute=2000, max_ttl_days=3650, version_retention=200 WHERE user_id=(SELECT id FROM users WHERE email='you@example.com');"
```

## Smoke test

```bash
curl -s -X POST http://localhost:8787/api/json \
  -H 'content-type: application/json' \
  -d '{"name":"Abhinav","role":"Backend Developer"}'

curl -s http://localhost:8787/json/<id>
```

## Deploy

1. Create D1 database, R2 bucket, KV namespaces, Queues in Cloudflare dashboard (or wrangler).
2. Update `worker/wrangler.jsonc` with real `database_id` / KV ids.
3. Set secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
4. Set GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
5. Push to `main` — CI runs; deploy workflows publish Worker + Pages.

Set production `APP_URL` / `API_URL` via Wrangler vars / Pages env `VITE_API_BASE_URL`.

## Project layout

```text
frontend/   React + Vite + Tailwind + Monaco
worker/     Hono API on Cloudflare Workers
.github/    CI + deploy workflows
```
