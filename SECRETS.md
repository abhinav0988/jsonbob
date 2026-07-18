# Secrets & what must stay private

This repo is public: https://github.com/abhinav0988/jsonbob

## Never commit

| Item | Where it lives instead |
|------|-------------------------|
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | `worker/.dev.vars` (local) or `wrangler secret put` (prod) |
| `GOOGLE_CLIENT_*` / `GITHUB_CLIENT_*` | Wrangler secrets |
| `CLOUDFLARE_API_TOKEN` | GitHub Actions secrets only |
| Any `.env` / `.dev.vars` | Local disk only (gitignored) |
| Personal access tokens (`ghp_…`, `github_pat_…`) | Never in this repo |

## Safe to commit

- Public Worker / Pages URLs
- D1 / KV / R2 **resource IDs** in `wrangler.jsonc` (not login passwords)
- `.env.example` placeholders
- Source code

## Local setup

```bash
# Worker secrets (local)
cp .env.example worker/.dev.vars   # then fill JWT_* only
# or create worker/.dev.vars manually

# Frontend
cp frontend/.env.example frontend/.env.development
```

## If a secret was ever pushed

1. Rotate it immediately (GitHub PAT, JWT secrets, Cloudflare token, OAuth secrets).
2. Remove from git history if needed (`git filter-repo` / BFG).
3. Confirm GitHub secret scanning alerts are cleared.
