-- Tags, favorites, per-doc schemas, durable audit log

CREATE TABLE IF NOT EXISTS document_tags (
  user_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, document_id, tag),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (document_id) REFERENCES documents(document_id)
);

CREATE INDEX IF NOT EXISTS idx_document_tags_user_tag ON document_tags(user_id, tag);
CREATE INDEX IF NOT EXISTS idx_document_tags_doc ON document_tags(document_id);

CREATE TABLE IF NOT EXISTS document_favorites (
  user_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, document_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (document_id) REFERENCES documents(document_id)
);

CREATE INDEX IF NOT EXISTS idx_document_favorites_user ON document_favorites(user_id);

CREATE TABLE IF NOT EXISTS document_schemas (
  document_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (document_id) REFERENCES documents(document_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  meta TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
