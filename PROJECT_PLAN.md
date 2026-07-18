# PROJECT_PLAN.md — JSONBlob Clone Platform

**Product name (working):** JSONBob  
**Goal:** Production-grade JSON document storage platform (JSONBlob.com–like) with public URLs, auth, versioning, analytics, and a **fully Cloudflare-native** data layer.  
**Status:** Planning only — no implementation yet.

**Data store decision:** **No MongoDB. No Redis.** All persistence, cache, sessions, and background work use Cloudflare only:

| Concern | Cloudflare service |
|---------|-------------------|
| Relational / metadata (users, docs, versions, analytics, plans, API keys) | **D1** |
| JSON document bodies + version payloads | **R2** |
| Response cache, sessions, rate-limit counters | **KV** |
| Expiry purge, analytics aggregation, emails | **Queues** |
| API / edge logic | **Workers** |
| Frontend hosting | **Pages** |

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Folder Structure](#4-folder-structure)
5. [Database Schema (Cloudflare-only)](#5-database-schema-cloudflare-only)
6. [Cloudflare Design](#6-cloudflare-design)
7. [API Documentation](#7-api-documentation)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Feature Specifications](#9-feature-specifications)
10. [Frontend Pages & UX](#10-frontend-pages--ux)
11. [Security Requirements](#11-security-requirements)
12. [Development Phases](#12-development-phases)
13. [Task Breakdown](#13-task-breakdown)
14. [Estimated Timeline](#14-estimated-timeline)
15. [DevOps & Deployment](#15-devops--deployment)
16. [Testing Strategy](#16-testing-strategy)
17. [Future Improvements](#17-future-improvements)
18. [Risks & Mitigations](#18-risks--mitigations)
19. [Definition of Done](#19-definition-of-done)

---

## 1. System Overview

JSONBob lets users create, store, share, and manage JSON documents via unique URLs and a REST API.

### Core user flows

| Flow | Description |
|------|-------------|
| Anonymous create | `POST /api/json` → unique public URL → `GET /json/:id` returns raw JSON |
| Authenticated CRUD | Logged-in users manage documents from dashboard with visibility, expiry, password |
| Share / download | Copy public URL, API URL, or download `.json` |
| Version history | Each update creates a new version; user can view/restore |
| Analytics | Request counts, storage usage, recent activity |
| Expiry cleanup | Cloudflare Queue consumers purge expired docs from R2 + D1 + KV |

### Design principles

- **Cloudflare-only data plane:** D1 + R2 + KV + Queues — **zero MongoDB / Redis**.
- **Edge-first:** Workers handle routing, JWT verify, rate limits, cache, and most API handlers against D1/R2 bindings.
- **Optional Node origin:** Express services may host complex/Swagger/Jest logic but **must talk only to Cloudflare** (Worker RPC, D1 HTTP API, or R2 S3 API) — never a separate database.
- **Split storage:** Metadata in D1; JSON bodies always in R2.
- **Cache aggressively:** KV caches public GET responses; invalidate on update/delete.
- **Plan-aware limits:** Free / Premium / Admin quotas enforced via D1 plan rows + KV rate counters.

---

## 2. System Architecture

### High-level diagram

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                                 USERS                                   │
│              (Browser / API Clients / Curl / Postman)                   │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Cloudflare Pages (React SPA)                        │
│         Vite + React + TS + Tailwind + Monaco + TanStack Query          │
└─────────────────────────────────┬───────────────────────────────────────┘
                                  │ HTTPS
                                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│         Cloudflare Worker (API Gateway + primary Edge Backend)          │
│  • Route matching (/api/*, /auth/*, /json/:id)                          │
│  • JWT verification                                                     │
│  • Rate limiting (KV; Durable Objects later)                            │
│  • D1 queries (users, docs metadata, versions, analytics)               │
│  • R2 get/put/delete (JSON bodies)                                      │
│  • KV cache for public JSON GETs + sessions                             │
│  • Enqueue Cloudflare Queues jobs                                       │
│  • Optional: proxy select routes to Node for heavy/Swagger/admin        │
└───────┬──────────────┬──────────────┬──────────────┬────────────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────────┐
   │   D1    │   │   R2    │   │   KV    │   │   Queues    │
   │ users   │   │ JSON    │   │ cache   │   │ expire      │
   │ docs    │   │ blobs   │   │ session │   │ analytics   │
   │ version │   │ versions│   │ rates   │   │ email       │
   │ stats   │   │         │   │         │   │             │
   └─────────┘   └─────────┘   └─────────┘   └─────────────┘

        (optional for Swagger / Jest / gradual migration)
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│         Node.js Backend (Express + TypeScript) — NO local DB            │
│  auth | users | documents | storage | analytics | notifications           │
│  Repositories call: Worker internal API / Cloudflare D1 & R2 clients      │
│  Socket.IO (reserved) | Swagger | Jest                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Explicit exclusions:** MongoDB, Mongoose, Redis, any non-Cloudflare primary store.

### Request path examples

**Anonymous public GET (cache hit)**

```text
Client → Worker → KV (hit) → Response (JSON)
```

**Authenticated document create**

```text
Client → Worker (JWT verify + KV rate limit)
  → D1 INSERT documents + update user quotas
  → R2 PUT documents/{userId}/{documentId}.json
  → Queue (analytics event)
  → Response { id, url }
```

**Expired document access**

```text
Client → Worker → D1 expire_at check → 410 Gone
  → Queue enqueue delete-expired
```

### Responsibility split

| Layer | Owns |
|-------|------|
| Pages (Frontend) | UI, client state, editor UX |
| Worker | Routing, JWT, rate limit, D1/R2/KV access, queue produce, most APIs |
| Node backend (optional) | Swagger-hosted origin, Socket.IO stub, Jest harness — **Cloudflare adapters only** |
| **D1** | **Canonical** app data: users, documents metadata, versions index, analytics, plans, API keys |
| **R2** | All JSON document bodies and version payloads |
| **KV** | Response cache, refresh sessions, rate-limit counters, short locks |
| **Queues** | Expiry purge, analytics aggregation, email jobs |

---

## 3. Technology Stack

### Frontend

| Tech | Purpose |
|------|---------|
| React.js | UI |
| TypeScript | Type safety |
| Vite | Build / dev server |
| Tailwind CSS | Styling + dark mode |
| TanStack Query | Server state / caching |
| React Router | SPA routing |
| Zustand | Client UI state (theme, editor prefs, share modal) |
| Axios | HTTP client (JWT refresh interceptors) |
| Monaco Editor | JSON editing + syntax highlight + format |

### Backend (Edge-primary + optional Node)

| Tech | Purpose |
|------|---------|
| Cloudflare Workers + TypeScript | Primary API / business logic |
| Node.js + TypeScript + Express | Optional origin for Swagger, Socket.IO, tests |
| **D1** (via Worker bindings / CF API) | Database — **replaces MongoDB** |
| **KV** | Sessions / cache / rate limits — **replaces Redis** |
| **R2** | Object storage for JSON |
| JWT (access + refresh) | Auth |
| Socket.IO | Scaffold for future collab (Node or Durable Objects later) |
| swagger-jsdoc / OpenAPI | API docs (Node or generated from shared contracts) |
| Jest + Vitest / Miniflare | Testing |
| Zod | Request validation |
| bcrypt / argon2 (Workers-compatible lib) | Password hashing |
| Helmet, cors (Node path) / Worker CORS | Hardening |

### Cloudflare (complete platform)

| Service | Purpose |
|---------|---------|
| Workers | API gateway + edge backend |
| D1 | **All** structured data (users, docs, versions, analytics, plans, keys) |
| R2 | JSON document + version bodies |
| KV | Cache, sessions, rate limits |
| Queues | Background jobs |
| Pages | Frontend hosting |
| Durable Objects (future) | Strong rate limiting / collab rooms |

### Supporting

| Tool | Purpose |
|------|---------|
| Wrangler | Local D1/R2/KV/Queues + deploy |
| docker-compose | **Optional** Node-only local process — **no Mongo/Redis containers** |
| GitHub Actions | CI/CD |
| Miniflare | Local Cloudflare simulation in tests |

---

## 4. Folder Structure

```text
jsonbob/
├── PROJECT_PLAN.md
├── README.md
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy-frontend.yml
│       ├── deploy-worker.yml
│       └── deploy-backend.yml          # only if Node origin is used
├── docker-compose.yml                  # optional Node only — no DB services
├── .env.example
│
├── frontend/                           # Cloudflare Pages app
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── api/
│       │   ├── client.ts
│       │   ├── auth.ts
│       │   ├── documents.ts
│       │   └── analytics.ts
│       ├── components/
│       │   ├── layout/
│       │   ├── editor/
│       │   ├── documents/
│       │   ├── dashboard/
│       │   └── ui/
│       ├── hooks/
│       ├── pages/
│       │   ├── LandingPage.tsx
│       │   ├── LoginPage.tsx
│       │   ├── RegisterPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── CreateJsonPage.tsx
│       │   ├── JsonEditorPage.tsx
│       │   ├── DocumentDetailsPage.tsx
│       │   ├── SettingsPage.tsx
│       │   ├── AdminDashboardPage.tsx
│       │   └── PublicJsonPage.tsx
│       ├── routes/
│       ├── store/
│       │   ├── authStore.ts
│       │   ├── themeStore.ts
│       │   └── editorStore.ts
│       ├── types/
│       └── utils/
│
├── backend/                            # Optional Express origin (Cloudflare adapters)
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.ts
│   ├── Dockerfile
│   └── src/
│       ├── index.ts
│       ├── app.ts
│       ├── config/
│       │   ├── env.ts
│       │   ├── swagger.ts
│       │   └── cloudflare.ts           # D1/R2/KV client config (NOT redis/mongo)
│       ├── auth/
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── auth.repository.ts      # D1 via CF API / internal Worker
│       │   ├── auth.routes.ts
│       │   ├── auth.validation.ts
│       │   └── auth.types.ts
│       ├── users/
│       ├── documents/
│       ├── storage/                    # R2 adapter
│       ├── analytics/
│       ├── notifications/
│       ├── middleware/
│       ├── db/                         # D1 SQL helpers / typed queries
│       │   ├── client.ts
│       │   ├── users.queries.ts
│       │   ├── documents.queries.ts
│       │   └── migrations/             # mirrored from worker/migrations
│       ├── utils/
│       ├── sockets/
│       └── tests/
│
├── worker/                             # Primary Cloudflare edge backend
│   ├── package.json
│   ├── wrangler.toml
│   ├── tsconfig.json
│   ├── migrations/                     # D1 SQL migrations
│   │   └── 0001_init.sql
│   └── src/
│       ├── index.ts
│       ├── router.ts
│       ├── middleware/
│       │   ├── auth.ts
│       │   ├── rateLimit.ts
│       │   └── cors.ts
│       ├── handlers/
│       │   ├── auth.ts
│       │   ├── documents.ts
│       │   ├── publicJson.ts
│       │   ├── profile.ts
│       │   ├── analytics.ts
│       │   ├── admin.ts
│       │   └── health.ts
│       ├── services/
│       │   ├── d1/
│       │   ├── r2.ts
│       │   ├── kvCache.ts
│       │   ├── kvSession.ts
│       │   └── queue.ts
│       └── types/
│
├── queues/
│   ├── wrangler.toml
│   └── src/
│       ├── consumers/
│       │   ├── expireDocuments.ts
│       │   ├── processAnalytics.ts
│       │   └── sendEmail.ts
│       └── index.ts
│
└── shared/
    ├── package.json
    └── src/
        ├── api-contracts.ts
        └── constants.ts
```

---

## 5. Database Schema (Cloudflare-only)

### 5.1 Cloudflare D1 — canonical application database

D1 is the **single source of truth** for structured data (replaces MongoDB entirely).

#### users

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                 -- ulid/uuid
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,                  -- null if OAuth-only (future)
  role TEXT NOT NULL CHECK (role IN ('free', 'premium', 'admin')),
  google_id TEXT,                      -- future OAuth
  storage_used_bytes INTEGER NOT NULL DEFAULT 0,
  document_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);
```

#### user_plans

```sql
CREATE TABLE user_plans (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  role TEXT NOT NULL,
  storage_quota_bytes INTEGER NOT NULL,
  document_quota INTEGER NOT NULL,
  api_rate_per_minute INTEGER NOT NULL,
  max_ttl_days INTEGER NOT NULL,
  version_retention INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
```

#### documents

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,                 -- internal id (optional; can equal document_id)
  document_id TEXT NOT NULL UNIQUE,    -- public id in URLs
  user_id TEXT,                        -- null = anonymous
  name TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private', 'password')),
  password_hash TEXT,
  r2_key TEXT NOT NULL,                -- documents/{userId|anonymous}/{documentId}.json
  size INTEGER NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/json',
  expire_at TEXT,                      -- ISO8601 or null
  version INTEGER NOT NULL DEFAULT 1,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_documents_user_created ON documents(user_id, created_at);
CREATE INDEX idx_documents_expire ON documents(expire_at);
CREATE INDEX idx_documents_visibility ON documents(visibility);
CREATE INDEX idx_documents_name ON documents(name);
```

#### document_versions

```sql
CREATE TABLE document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,           -- public document_id
  version INTEGER NOT NULL,
  r2_key TEXT NOT NULL,                -- documents/.../v/{version}.json
  size INTEGER NOT NULL,
  created_by TEXT,                     -- user id
  created_at TEXT NOT NULL,
  UNIQUE (document_id, version),
  FOREIGN KEY (document_id) REFERENCES documents(document_id)
);

CREATE INDEX idx_versions_doc_created ON document_versions(document_id, created_at);
```

#### analytics_events

```sql
CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  user_id TEXT,                        -- owner
  ip_hash TEXT NOT NULL,               -- hashed/truncated for privacy
  user_agent TEXT,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_analytics_doc_created ON analytics_events(document_id, created_at);
CREATE INDEX idx_analytics_user_created ON analytics_events(user_id, created_at);
```

#### document_stats (aggregates)

```sql
CREATE TABLE document_stats (
  document_id TEXT PRIMARY KEY,
  total_requests INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TEXT,
  unique_ips_approx INTEGER NOT NULL DEFAULT 0
);
```

#### api_keys (Phase 4+)

```sql
CREATE TABLE api_keys (
  key_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  key_hash TEXT NOT NULL,
  name TEXT,
  last_used_at TEXT,
  created_at TEXT NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_api_keys_user ON api_keys(user_id);
```

**No dual-write:** D1 is authoritative. Workers read/write D1 directly via bindings. Optional Node origin uses the same D1 (HTTP API or private Worker fetch) — never a second database.

---

### 5.2 Cloudflare R2 layout

All JSON content lives in R2 (no inline document bodies in D1 except tiny ephemeral cases — **prefer always R2**).

```text
documents/
  {userId|anonymous}/
    {documentId}.json
    {documentId}/
      v/{version}.json
```

| Condition | Storage |
|-----------|---------|
| Any persisted document | R2 body + D1 metadata |
| Versions | R2 `v/{n}.json` + `document_versions` row |

---

### 5.3 Cloudflare KV keys (replaces Redis)

| Key pattern | Purpose | TTL |
|-------------|---------|-----|
| `cache:json:{documentId}` | Cached public JSON body + ETag | short / on invalidate |
| `cache:meta:{documentId}` | Visibility / expire / version / r2_key | short / on invalidate |
| `sess:{userId}` | Refresh session metadata | matching refresh TTL |
| `rt:{tokenHash}` | Refresh token validity | 7–30 days |
| `rl:ip:{ip}` / `rl:user:{id}` | Rate limit counters | 60s window |
| `lock:expire:{documentId}` | Purge lock | short |

**Invalidation:** On PUT/DELETE/expire → delete `cache:json:*` and `cache:meta:*`.

---

## 6. Cloudflare Design

### 6.1 Worker responsibilities

1. **API routing** — `/api/*`, `/auth/*`, `/documents/*`, `/json/:id`.
2. **Auth** — Issue/verify JWT; store refresh tokens in KV.
3. **Rate limiting** — KV counters (upgrade to Durable Objects later).
4. **D1** — All CRUD for users, documents metadata, versions, analytics.
5. **R2** — Put/get/delete JSON payloads.
6. **KV cache** — Public GET fast path.
7. **Queues** — Produce expire / analytics / email jobs.
8. **CORS** — Pages origin allowlist.

### 6.2 Queues

| Queue | Consumer action |
|-------|-----------------|
| `expire-documents` | Delete R2 objects, soft/hard-delete D1 rows, purge KV |
| `analytics-process` | Batch upsert `analytics_events` / `document_stats` in D1 |
| `email-notifications` | Expiry warnings, quota alerts (future Email Workers / ESP) |

### 6.3 Pages

- Vite build → Cloudflare Pages.
- SPA fallback for app routes; **Worker serves raw `/json/:id`** as `application/json`.

---

## 7. API Documentation

Base URL (prod): `https://api.domain.com` or same origin via Worker `/api`.

Content-Type: `application/json` unless noted.

Auth header: `Authorization: Bearer <accessToken>`.

### 7.1 Convenience JSONBlob-compatible endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/json` | Optional | Create blob; returns `{ id, url }` |
| GET | `/json/:id` | None* | Return raw JSON document |
| PUT | `/json/:id` | Owner / password | Replace content |
| DELETE | `/json/:id` | Owner | Delete document |

\* Private / password-protected require auth or password header.

#### POST `/api/json`

**Request**

```json
{
  "name": "Abhinav",
  "role": "Backend Developer"
}
```

Wrapped form (authenticated options):

```json
{
  "content": { "name": "Abhinav", "role": "Backend Developer" },
  "visibility": "public",
  "expireAt": "2026-08-01T00:00:00.000Z",
  "password": null,
  "name": "profile-snippet"
}
```

**Response `201`**

```json
{
  "id": "abc123",
  "url": "https://domain.com/json/abc123"
}
```

#### GET `/json/abc123`

**Response `200`** — raw body from R2 (or KV cache):

```json
{
  "name": "Abhinav",
  "role": "Backend Developer"
}
```

Errors: `404` not found; `401`/`403` private/password; `410` expired.

---

### 7.2 Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Create account (D1 `users`) |
| POST | `/auth/login` | No | Obtain tokens |
| POST | `/auth/logout` | Yes | Invalidate refresh token (KV) |
| POST | `/auth/refresh` | Refresh cookie/body | Rotate access token |
| GET | `/auth/me` | Yes | Current user |

#### POST `/auth/register`

```json
{
  "name": "Abhinav",
  "email": "abhinav@example.com",
  "password": "SecurePass123!"
}
```

**Response `201`**

```json
{
  "user": {
    "id": "...",
    "name": "Abhinav",
    "email": "abhinav@example.com",
    "role": "free"
  },
  "accessToken": "...",
  "refreshToken": "..."
}
```

#### POST `/auth/logout`

Invalidates refresh token in **KV** (`rt:{tokenHash}`).

#### POST `/auth/refresh`

```json
{
  "refreshToken": "..."
}
```

---

### 7.3 Documents

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/documents` | Yes* | Create |
| GET | `/documents` | Yes | List (pagination, search, filters) |
| GET | `/documents/:id` | Conditional | Metadata + content (R2) |
| PUT | `/documents/:id` | Owner | Full replace |
| PATCH | `/documents/:id` | Owner | Partial meta update |
| DELETE | `/documents/:id` | Owner | Soft delete + queue purge |
| POST | `/documents/:id/duplicate` | Owner | Clone |
| GET | `/documents/:id/versions` | Owner | List versions |
| GET | `/documents/:id/versions/:version` | Owner | Version content |
| POST | `/documents/:id/versions/:version/restore` | Owner | Restore |
| GET | `/documents/:id/download` | Conditional | Attachment download |

\* Plan limits from D1 `user_plans`.

#### POST `/documents`

```json
{
  "content": { "hello": "world" },
  "visibility": "public",
  "expireAt": null,
  "password": null,
  "name": "hello"
}
```

**Response `201`**

```json
{
  "id": "abc123",
  "url": "https://domain.com/json/abc123",
  "apiUrl": "https://domain.com/api/documents/abc123",
  "visibility": "public",
  "size": 17,
  "version": 1,
  "createdAt": "2026-07-14T12:00:00.000Z"
}
```

---

### 7.4 User / Profile

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/profile` | Yes | Profile + quotas (D1) |
| PUT | `/profile` | Yes | Update name/password |
| GET | `/profile/usage` | Yes | Storage + document counts |

---

### 7.5 Analytics

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/analytics` | Yes | Owner overview |
| GET | `/analytics/documents/:id` | Owner | Per-document stats |
| GET | `/analytics/admin` | Admin | Platform-wide |

```json
{
  "totalDocuments": 42,
  "storageUsedBytes": 128450,
  "storageQuotaBytes": 10485760,
  "apiRequestCount": 1520,
  "recentDocuments": []
}
```

---

### 7.6 Admin

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/admin/users` | Admin | List users |
| PATCH | `/admin/users/:id` | Admin | Change role / deactivate |
| GET | `/admin/documents` | Admin | Global search |
| DELETE | `/admin/documents/:id` | Admin | Force delete |

---

### 7.7 Health & docs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| GET | `/ready` | D1 + R2 + KV binding readiness |
| GET | `/api-docs` | Swagger / OpenAPI UI |

---

### 7.8 Error format

```json
{
  "error": {
    "code": "DOCUMENT_NOT_FOUND",
    "message": "Document not found",
    "details": null,
    "requestId": "req_..."
  }
}
```

Common codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `RATE_LIMITED`, `DOCUMENT_EXPIRED`, `QUOTA_EXCEEDED`, `INVALID_JSON`.

---

## 8. Authentication & Authorization

### Roles

| Role | Capabilities |
|------|----------------|
| Free | Own docs under free quotas |
| Premium | Higher quotas, longer TTL, password docs, more versions |
| Admin | Admin APIs + user management |

### JWT

| Token | Lifetime | Storage |
|-------|----------|---------|
| Access | 15 minutes | Memory / Axios header |
| Refresh | 7 days (free) / 30 days (premium) | HttpOnly cookie preferred + **KV** |

Claims: `sub`, `email`, `role`, `iat`, `exp`, `jti`.

### Future: Google OAuth

- `GET /auth/google` / callback → upsert D1 user (`google_id`), issue tokens.

### Password-protected documents

- Header `X-Document-Password`; hash stored in D1 `documents.password_hash`.

---

## 9. Feature Specifications

### JSON management

| Feature | Notes |
|---------|-------|
| Create | D1 meta + R2 body; validate JSON |
| Edit | Monaco → PUT; new version in D1 + R2 |
| Delete | Soft delete D1 → Queue hard purge R2/KV |
| Duplicate | New `document_id`; copy R2 object |
| Share / Download / Copy API URL | Dashboard actions |
| Public / private / password | D1 `visibility` |
| Expiry | D1 `expire_at`; Worker 410; Queue cleanup |

### Quotas (initial)

| Limit | Free | Premium |
|-------|------|---------|
| Documents | 50 | 5,000 |
| Max size / doc | 100 KB | 5 MB |
| Total storage | 10 MB | 1 GB |
| Version retention | 5 | 50 |
| Max TTL | 7 days | 365 days |
| Rate (req/min) | 60 | 600 |

---

## 10. Frontend Pages & UX

| Page | Route |
|------|-------|
| Landing | `/` |
| Login | `/login` |
| Register | `/register` |
| Dashboard | `/dashboard` |
| Create JSON | `/documents/new` |
| JSON Editor | `/documents/:id/edit` |
| Document Details | `/documents/:id` |
| Settings | `/settings` |
| Admin Dashboard | `/admin` |
| Pretty public view (optional) | `/view/:id` (raw: `/json/:id`) |

UI inspired by JSONBlob / Postman / GitHub: dark mode, Monaco, format/minify, copy/share, responsive.

- **TanStack Query:** server data  
- **Zustand:** theme, editor dirty state, auth UI  

---

## 11. Security Requirements

| Control | Implementation |
|---------|----------------|
| JWT security | Short access; rotate refresh; revoke in **KV** |
| Password hashing | argon2id / bcrypt (Workers-compatible) |
| Rate limiting | Worker + **KV** (Durable Objects later) |
| Request validation | Zod per route |
| XSS / CSP | React escaping + headers |
| CORS | Explicit allowlist |
| Helmet | On Node path if used |
| Input sanitization | Strip `__proto__` / pollution keys |
| HTTPS / HSTS | Cloudflare |
| Secrets | Wrangler secrets — never commit |
| Private docs | Ownership check always in Worker/D1 |

---

## 12. Development Phases

### Phase 1 — Foundation (CRUD + Auth on Cloudflare)

- Frontend Vite + Tailwind + Router + Query + Zustand + Axios + Monaco
- Worker + D1 migrations (users, documents)
- R2 put/get for document bodies
- KV for refresh sessions
- Register / Login / Logout / Refresh
- Document CRUD + public `/json/:id` + `/api/json`
- Optional Express scaffold with Cloudflare adapters (no Mongo/Redis)
- Jest/Miniflare smoke tests
- OpenAPI/Swagger skeleton

### Phase 2 — Edge hardening & storage polish

- Worker as sole public entry (Pages + API)
- KV cache for public GETs
- Queue expire consumer v1
- Pages deploy pipeline
- Cutover all traffic through Worker bindings

### Phase 3 — Dashboard, analytics, versions

- Dashboard metrics (D1 aggregates)
- Search / date filters
- Version history + restore (D1 + R2)
- Analytics events + Queue aggregation
- Duplicate / download / share UX
- Socket.IO stub (optional Node)

### Phase 4 — Security, limits, premium

- Hardened KV rate limiting
- Quotas via `user_plans`
- Password-protected documents
- Admin APIs + UI
- API keys in D1 (stretch)
- Security review

### Phase 5 — Deploy, CI/CD, monitoring

- GitHub Actions: lint/test/build/`wrangler deploy`
- Pages + Worker + Queues + D1 migrations in prod
- Logging, Sentry/Workers Analytics, uptime
- Load test public GET path

---

## 13. Task Breakdown

### Phase 1

| ID | Task | Area |
|----|------|------|
| P1-01 | Init frontend Vite React-TS + Tailwind | FE |
| P1-02 | Init Worker + wrangler (D1/R2/KV bindings) | CF |
| P1-03 | D1 migration: users + documents | CF |
| P1-04 | Env + `.env.example` (no Mongo/Redis vars) | All |
| P1-05 | Auth register/login against D1 + KV sessions | CF |
| P1-06 | JWT middleware (Worker) | CF |
| P1-07 | Documents CRUD: D1 meta + R2 body | CF |
| P1-08 | Public `/json/:id` + `/api/json` | CF |
| P1-09 | OpenAPI/Swagger setup | BE/CF |
| P1-10 | Auth pages + Axios interceptors | FE |
| P1-11 | Create/Edit with Monaco | FE |
| P1-12 | Miniflare/Jest auth + document tests | CF |
| P1-13 | Landing + protected route guards | FE |
| P1-14 | Optional Express + Cloudflare adapters | BE |

### Phase 2

| ID | Task | Area |
|----|------|------|
| P2-01 | Edge JWT + CORS complete | CF |
| P2-02 | KV cache for public GET | CF |
| P2-03 | Queue expire consumer | CF |
| P2-04 | Pages deploy config | FE/CF |
| P2-05 | Ready checks for D1/R2/KV | CF |

### Phase 3

| ID | Task | Area |
|----|------|------|
| P3-01 | Versions on update (D1 + R2) | CF |
| P3-02 | Versions API + restore | CF |
| P3-03 | Analytics write path | CF |
| P3-04 | Analytics aggregate Queue consumer | CF |
| P3-05 | Dashboard page | FE |
| P3-06 | Document details + history UI | FE |
| P3-07 | Search/filter | FE/CF |
| P3-08 | Duplicate/download/share | FE |
| P3-09 | Socket.IO stub | BE |

### Phase 4

| ID | Task | Area |
|----|------|------|
| P4-01 | KV rate limits (per IP/user) | CF |
| P4-02 | Quota enforcement (`user_plans`) | CF |
| P4-03 | Password-protected docs | CF/FE |
| P4-04 | Premium role gating | CF |
| P4-05 | Admin APIs | CF |
| P4-06 | Admin dashboard UI | FE |
| P4-07 | Security headers / sanitization audit | CF |
| P4-08 | API keys in D1 (stretch) | CF |

### Phase 5

| ID | Task | Area |
|----|------|------|
| P5-01 | CI: lint, typecheck, test | DevOps |
| P5-02 | CD: Pages | DevOps |
| P5-03 | CD: Worker + Queues + D1 migrate | DevOps |
| P5-04 | CD: optional Node container | DevOps |
| P5-05 | Monitoring + alerts | Ops |
| P5-06 | Prod Wrangler secrets | Ops |
| P5-07 | Load test + fix bottlenecks | All |
| P5-08 | README + runbooks | Docs |

---

## 14. Estimated Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1 — Setup, Auth, CRUD (D1/R2/KV) | 2–3 weeks | Week 3 |
| Phase 2 — Edge cache, Queues, Pages | 1.5–2 weeks | Week 5 |
| Phase 3 — Dashboard, Analytics, Versions | 2 weeks | Week 7 |
| Phase 4 — Security, Rate limits, Premium | 1.5–2 weeks | Week 9 |
| Phase 5 — Deployment, CI/CD, Monitoring | 1–1.5 weeks | Week 10–11 |

**Total estimate: ~10–11 weeks** to production MVP (Cloudflare-only data plane).

### Milestones

| Milestone | Exit criteria |
|-----------|---------------|
| M1 | Register, create JSON (D1+R2), open public URL |
| M2 | KV-cached public GET; expiry Queue works |
| M3 | Dashboard metrics; versions restorable |
| M4 | Quotas + password docs + admin |
| M5 | Automated Cloudflare deploys; health monitored |

---

## 15. DevOps & Deployment

### Local development

Prefer **`wrangler dev`** with local D1/R2/KV/Queues.

`docker-compose.yml` (optional):

- `backend` only (Node) — **do not add MongoDB or Redis services**

### Environment variables (summary)

**Worker / Queues:** bindings in `wrangler.toml` for `DB` (D1), `DOCUMENTS` (R2), `CACHE`/`SESSIONS` (KV), queues; secrets: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`.

**Frontend:** `VITE_API_BASE_URL`, `VITE_APP_URL`.

**Optional Node:** `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `D1_DATABASE_ID`, `R2_*`, `JWT_*`, `CORS_ORIGIN`, `WORKER_INTERNAL_URL` — **no `MONGODB_URI` or `REDIS_URL`**.

### CI/CD

1. **ci.yml** — lint, typecheck, tests (Miniflare), frontend build  
2. **deploy-frontend.yml** — Cloudflare Pages  
3. **deploy-worker.yml** — `wrangler deploy` + `wrangler d1 migrations apply`  
4. **deploy-backend.yml** — optional Node image  

### Production topology

```text
Cloudflare DNS
  ├─ domain.com          → Pages (SPA)
  ├─ domain.com/json/*   → Worker (raw JSON from KV/R2)
  └─ api.domain.com/*    → Worker (D1 + R2 + KV)
       └─ (optional) internal Node for Swagger-only paths
```

---

## 16. Testing Strategy

| Layer | Tools | Scope |
|-------|-------|-------|
| Unit | Jest / Vitest | Validators, JWT, pure services |
| Integration | Miniflare / vitest-pool-workers | Auth + documents against local D1/R2/KV |
| Worker | Miniflare | Cache hit/miss, rate limit, expiry |
| E2E (later) | Playwright | Create → share → edit → expire |
| Load | k6 / artillery | Public GET throughput |

---

## 17. Future Improvements

- Google OAuth / GitHub OAuth  
- Collaborative editing (Durable Objects / Socket.IO)  
- Webhooks on update  
- Custom domains for Premium  
- JSON Schema validation per document  
- Team workspaces  
- Stripe billing  
- Tree-view JSON preview  
- Durable Objects rate limits  
- CLI (`npx jsonbob push file.json`)  
- Typed OpenAPI SDK  

---

## 18. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| D1 query limits / size | Slow lists | Indexes, pagination, aggregates in `document_stats` |
| Large anonymous abuse | Cost | KV rate limits; size caps; CAPTCHA later |
| Cache serving private data | Leak | Never cache private/password bodies |
| Expiry race | Storage leaks | Queue + periodic D1 scan of `expire_at` |
| Monaco bundle size | Slow load | Lazy-load editor route |
| Node ↔ Worker duplication | Drift | Prefer Worker-first; shared contracts in `shared/` |

---

## 19. Definition of Done

1. Implemented against API contracts above  
2. Data only in **D1 / R2 / KV / Queues** (no MongoDB/Redis)  
3. Tests where applicable (Miniflare)  
4. Documented in OpenAPI  
5. AuthZ enforced (role + ownership + visibility)  
6. Deployable via Wrangler / CI  

---

## Appendix A — Public URL contract (MVP)

```text
POST /api/json
  body: any valid JSON
  → { "id": "<id>", "url": "https://<domain>/json/<id>" }

GET /json/<id>
  → document JSON body (application/json) from KV cache or R2
```

## Appendix B — Module pattern

Every domain module exposes: `controller`, `service`, `repository` (D1/R2/KV), `routes`, `validation`, `types`.

Repositories **must not** import Mongoose, MongoDB drivers, or Redis clients.

## Appendix C — Suggested first implementation order

1. Worker + D1 migrations + R2/KV bindings via Wrangler  
2. Auth (D1 users + KV refresh tokens)  
3. Documents CRUD + `/api/json` + `/json/:id`  
4. Frontend login + Monaco create/view  
5. KV public cache + expire Queue  
6. Dashboard / versions / analytics  
7. Hardening + plans + admin  
8. CI/CD + monitoring  

## Appendix D — Explicitly out of scope (storage)

- ❌ MongoDB / Mongoose  
- ❌ Redis / ioredis  
- ❌ Any non-Cloudflare primary database for production data  

---

**End of plan.** Cloudflare-only data plane. Ready for implementation when approved — Phase 1, task P1-01.
