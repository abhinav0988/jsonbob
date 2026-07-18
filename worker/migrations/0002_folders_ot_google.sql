-- Server folders + one-time burn tokens

CREATE TABLE IF NOT EXISTS document_folders (
  document_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  folder TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_document_folders_user ON document_folders(user_id, folder);

CREATE TABLE IF NOT EXISTS one_time_tokens (
  token TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  user_id TEXT,
  created_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (document_id) REFERENCES documents(document_id)
);

CREATE INDEX IF NOT EXISTS idx_one_time_doc ON one_time_tokens(document_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
