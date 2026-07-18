# GitHub repository cleaner

Deletes **all repositories owned by you** except one protected repo (`KEEP_REPO`).

> **Dangerous.** Deletion is permanent. Always review the printed list and type `DELETE ALL` only when sure.

## Setup

```bash
cd tools/github-delete-repos
cp .env.example .env
# Edit .env — never commit .env
npm install
```

### `.env` variables

| Variable | Description |
|----------|-------------|
| `GITHUB_USERNAME` | Your GitHub username |
| `GITHUB_TOKEN` | Personal access token (see scopes below) |
| `KEEP_REPO` | Exact repo name to keep (e.g. `portfolio`) |

Credentials are read **only** from `.env` via `dotenv`. Nothing is hardcoded.

### Token scopes

- **Classic PAT:** `repo` + `delete_repo`
- **Fine-grained PAT:** Repository access to the repos you may delete, with **Administration: Read and write** (required for delete)

If you ever paste a token into chat or commit it, **revoke it immediately** and create a new one.

## Run

```bash
npm start
```

The script will:

1. Fetch every owned repository (paginated)
2. Print the repo to keep and the list to delete
3. Wait until you type exactly `DELETE ALL`
4. Delete each repo, continue on failure, print a summary

## Safety

- Only repositories whose `owner.login` matches `GITHUB_USERNAME` are considered
- `KEEP_REPO` is matched by exact repository name
- No deletions happen without the confirmation phrase
- Failed deletions are reported; the script continues with the rest

## Files

| File | Purpose |
|------|---------|
| `delete-repos.mjs` | Main script |
| `package.json` | Dependencies and `npm start` |
| `.env.example` | Env template (no secrets) |
| `.env` | Your secrets (gitignored) |
| `.gitignore` | Ignores `.env` and `node_modules` |
