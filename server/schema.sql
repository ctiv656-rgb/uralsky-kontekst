CREATE TABLE IF NOT EXISTS limits (
  ip_hash TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  payload TEXT,
  state TEXT NOT NULL DEFAULT 'pending',
  category TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS outbox_pending ON outbox(state, created_at);
