-- 万能小説 (UniversalNovelReader) Cloudflare D1 初期化スキーマ
-- Cloudflare 管理画面の「D1 SQL データベース → コンソール」に貼り付けて実行してください。

CREATE TABLE IF NOT EXISTS community_adapters (
  adapter_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT 'anonymous',
  description TEXT NOT NULL DEFAULT '',
  domain_pattern TEXT NOT NULL,
  adapter_type TEXT NOT NULL,
  package_json TEXT NOT NULL,
  edit_token_hash TEXT,
  likes INTEGER NOT NULL DEFAULT 0,
  reports INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_adapters_likes
  ON community_adapters (likes DESC, updated_at DESC);

CREATE TABLE IF NOT EXISTS adapter_votes (
  adapter_id TEXT NOT NULL,
  voter_hash TEXT NOT NULL,
  vote_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (adapter_id, voter_hash, vote_type)
);

CREATE TABLE IF NOT EXISTS submission_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_submission_logs_ip_time
  ON submission_logs (ip_hash, created_at);
