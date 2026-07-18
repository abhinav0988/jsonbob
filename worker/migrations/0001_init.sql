-- JSONBob D1 schema (Cloudflare-only data plane)

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT,
  role TEXT NOT NULL CHECK (role IN ('free', 'premium', 'admin')),
  google_id TEXT,
  storage_used_bytes INTEGER NOT NULL DEFAULT 0,
  document_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

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

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL UNIQUE,
  user_id TEXT,
  name TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private', 'password')),
  password_hash TEXT,
  r2_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/json',
  expire_at TEXT,
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

CREATE TABLE document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (document_id, version)
);

CREATE INDEX idx_versions_doc_created ON document_versions(document_id, created_at);

CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  user_id TEXT,
  ip_hash TEXT NOT NULL,
  user_agent TEXT,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_analytics_doc_created ON analytics_events(document_id, created_at);
CREATE INDEX idx_analytics_user_created ON analytics_events(user_id, created_at);

CREATE TABLE document_stats (
  document_id TEXT PRIMARY KEY,
  total_requests INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TEXT,
  unique_ips_approx INTEGER NOT NULL DEFAULT 0
);

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
