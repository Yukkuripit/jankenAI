-- migrations/0001_init.sql
CREATE TABLE IF NOT EXISTS user_stats (
    user_id TEXT PRIMARY KEY,
    janken TEXT NOT NULL,
    acchi TEXT NOT NULL,
    total_plays INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_user_stats_updated ON user_stats(updated_at);