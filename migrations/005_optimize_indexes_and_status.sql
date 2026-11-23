-- Optimize short_links & clicks indexes and add rolled-up redirect counter
-- 1. Drop redundant B-tree indexes already backed by UNIQUE constraints
DROP INDEX IF EXISTS idx_short_links_short_url;
DROP INDEX IF EXISTS idx_short_links_custom_alias;
DROP INDEX IF EXISTS idx_api_keys_key;

-- 2. Composite index for per-link analytics ordered by timestamp DESC
CREATE INDEX IF NOT EXISTS idx_clicks_short_link_id_timestamp
    ON clicks (short_link_id, timestamp DESC);

-- 3. Partial index for background expiration sweeps (ignores non-expiring rows)
CREATE INDEX IF NOT EXISTS idx_short_links_expires_at
    ON short_links (expires_at)
    WHERE expires_at IS NOT NULL;

-- 4. Optional rolled-up redirect counter (updated asynchronously by analytics rollups)
ALTER TABLE short_links
    ADD COLUMN IF NOT EXISTS redirect_count BIGINT NOT NULL DEFAULT 0;
