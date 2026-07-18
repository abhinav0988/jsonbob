# jsonbob — Security & compliance narrative

**Product:** jsonbob · Cloudflare Workers + D1 + R2 + KV + Durable Objects  
**Audience:** customers evaluating trust / SOC 2 readiness · not a certification claim

## Security controls in product

| Control | Implementation |
|---------|----------------|
| Transport | HTTPS only on Workers `.dev` / custom domains |
| AuthN | JWT access + refresh; Google OAuth when secrets set |
| AuthZ | Owner checks on mutate; admin role for `/admin` |
| Passwords | Hashed at rest; document passwords via header compare |
| Input | Zod on mutating routes; `sanitizeJson` strips prototype pollution keys |
| Rate limits | Middleware on auth, documents, AI, API keys, public JSON |
| CORS | Explicit allowlist (`APP_URL` + localhost); disallowed origins get no ACAO |
| Secrets | Wrangler secrets — never commit `.dev.vars` |
| Soft delete | Trash + purge; version history retention by plan |
| Audit | Durable `audit_log` for owner actions (folder/tags/favorite/share/delete/schema) |
| API keys | Prefix + hashed secret; revoke |
| Collab | Presence comments ephemeral in Durable Object memory |

## Data residency & subprocessors

- Primary compute/storage: **Cloudflare** (Workers, D1, R2, KV, Queues, AI, DO)
- Optional Google accounts for OAuth identity only

## SOC 2 readiness posture (narrative)

jsonbob is engineered for a **shared-responsibility** SaaS model:

1. **Customer** owns content confidentiality choices (visibility, passwords, expiry, OT links).  
2. **Operator** configures Cloudflare account IAM, secrets rotation, and remote D1 migrations.  
3. **Platform** provides logging surfaces (`audit_log`, analytics) suitable for evidence collection.

This document is **not** a SOC 2 Type II report. Formal certification requires independent auditor engagement, change-management SOPs, and production access reviews outside this repository.

## SCIM / org workspaces

Enterprise SCIM provisioning and multi-tenant org workspaces are **deferred**. Current tenancy is **user-scoped** documents with private library metadata (folders, tags, favorites).

## Incident contact

Operators: rotate `JWT_*` and OAuth secrets via `wrangler secret put`, invalidate sessions in KV `SESSIONS`, and review `audit_log` for the affected user.
