-- Store a safe display prefix for hashed API keys (plaintext keys are never persisted)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_prefix TEXT;
