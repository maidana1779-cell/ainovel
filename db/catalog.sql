-- Use only for products with an explicit authorized data-storage contract.
CREATE TABLE IF NOT EXISTS catalog_products (
 product_key CHAR(64) PRIMARY KEY,
 source_id VARCHAR(80) NOT NULL,
 external_id VARCHAR(160) NOT NULL,
 category VARCHAR(24) NOT NULL CHECK (category IN ('food','living','digital','beauty','fashion','kitchen')),
 title VARCHAR(220) NOT NULL,
 cp_name VARCHAR(120) NOT NULL,
 cp_code VARCHAR(100) NOT NULL DEFAULT '',
 price BIGINT,
 photo TEXT,
 commissionlink TEXT NOT NULL,
 checked_at TIMESTAMPTZ NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS catalog_browse_idx ON catalog_products(category,checked_at DESC);
CREATE INDEX IF NOT EXISTS catalog_expiry_idx ON catalog_products(expires_at);
CREATE TABLE IF NOT EXISTS catalog_sync_runs (
 id BIGSERIAL PRIMARY KEY,
 source_id VARCHAR(80) NOT NULL,
 received INTEGER NOT NULL,
 imported INTEGER NOT NULL,
 rejected INTEGER NOT NULL,
 executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
